param(
  [Parameter(Mandatory=$true)]
  [string]$ProjectPath
)

$ErrorActionPreference = 'Stop'
$ProjectPath = (Resolve-Path -LiteralPath $ProjectPath).Path
$PagePath = Join-Path $ProjectPath 'app\page.tsx'
$CssPath = Join-Path $ProjectPath 'app\globals.css'
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupRoot = Join-Path $ProjectPath ".mecardee-patch-backup\v8.9.13-$Stamp"
$Marker = 'MECARDEE_BOOKING_CONFLICT_GUARD_V8_9_13'

if (-not (Test-Path -LiteralPath $PagePath)) { throw "app\page.tsx was not found in $ProjectPath" }
if (-not (Test-Path -LiteralPath $CssPath)) { throw "app\globals.css was not found in $ProjectPath" }
if (-not (Test-Path -LiteralPath (Join-Path $ProjectPath 'package.json'))) { throw "package.json was not found in $ProjectPath" }

$CurrentPage = Get-Content -LiteralPath $PagePath -Raw
if ($CurrentPage -match $Marker) {
  Write-Host 'Mecardee booking conflict guard v8.9.13 is already applied.' -ForegroundColor Yellow
  exit 0
}
if ($CurrentPage -notmatch 'function BookingsView' -or $CurrentPage -notmatch 'type BookingRecord') {
  throw 'This patch expects the dedicated Bookings-tab build (v8.9.12). Apply Mecardee-BookingsTab-v8.9.12 first.'
}

New-Item -ItemType Directory -Force -Path (Join-Path $BackupRoot 'app') | Out-Null
Copy-Item -LiteralPath $PagePath -Destination (Join-Path $BackupRoot 'app\page.tsx') -Force
Copy-Item -LiteralPath $CssPath -Destination (Join-Path $BackupRoot 'app\globals.css') -Force

$NodePatch = Join-Path $ProjectPath '.mecardee-booking-conflict-v8.9.13.mjs'
@'
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2];
const pagePath = path.join(root, "app", "page.tsx");
const cssPath = path.join(root, "app", "globals.css");
let page = fs.readFileSync(pagePath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");
const marker = "MECARDEE_BOOKING_CONFLICT_GUARD_V8_9_13";

function replaceOnce(search, replacement, label) {
  if (!page.includes(search)) throw new Error(`Could not find ${label}. The project may differ from v8.9.12.`);
  page = page.replace(search, replacement);
}

replaceOnce(
  '<NewBookingDialog vehicles={vehicleList} customers={customerList} seed={bookingSeed}',
  '<NewBookingDialog vehicles={vehicleList} customers={customerList} bookings={bookingList} seed={bookingSeed}',
  'NewBookingDialog render'
);

replaceOnce(
  'function NewBookingDialog({ vehicles, customers, seed, close, done, showToast }: { vehicles: Vehicle[]; customers: CustomerRow[]; seed: { vehicleId: string; date: string } | null; close: () => void; done: (message: string) => void; showToast: (message: string) => void }) {',
  'function NewBookingDialog({ vehicles, customers, bookings, seed, close, done, showToast }: { vehicles: Vehicle[]; customers: CustomerRow[]; bookings: BookingRecord[]; seed: { vehicleId: string; date: string } | null; close: () => void; done: (message: string) => void; showToast: (message: string) => void }) {',
  'NewBookingDialog signature'
);

replaceOnce(
  '  const days = Math.max(1, Number(daysInput) || 1);',
  `  const days = Math.max(1, Number(daysInput) || 1);\n  // ${marker}\n  // Block overlapping bookings immediately in the booking form. The API remains the final race-condition guard.\n  const requestedStartMs = useMemo(() => new Date(\`${'${startDate}'}T${'${startTime}'}:00+05:30\`).getTime(), [startDate, startTime]);\n  const requestedEndMs = useMemo(() => new Date(\`${'${returnDate}'}T${'${returnTime}'}:00+05:30\`).getTime(), [returnDate, returnTime]);\n  const vehicleBookings = useMemo(() => bookings\n    .filter((booking) => booking.vehicleId === vehicleId && [\"booked\", \"rented\"].includes(booking.status))\n    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()), [bookings, vehicleId]);\n  const conflictingBooking = useMemo(() => {\n    if (!Number.isFinite(requestedStartMs) || !Number.isFinite(requestedEndMs) || requestedEndMs <= requestedStartMs) return null;\n    return vehicleBookings.find((booking) => {\n      const existingStart = new Date(booking.startAt).getTime();\n      const existingEnd = new Date(booking.endAt).getTime();\n      return existingStart < requestedEndMs && existingEnd > requestedStartMs;\n    }) ?? null;\n  }, [vehicleBookings, requestedStartMs, requestedEndMs]);\n  const conflictToastKey = useRef(\"\");\n\n  useEffect(() => {\n    if (!conflictingBooking) { conflictToastKey.current = \"\"; return; }\n    const key = \`${'${conflictingBooking.id}'}|${'${startDate}'}|${'${startTime}'}|${'${returnDate}'}|${'${returnTime}'}\`;\n    if (conflictToastKey.current === key) return;\n    conflictToastKey.current = key;\n    showToast(\`Date unavailable: ${'${selectedVehicle?.name ?? "Vehicle"}'} already has ${'${conflictingBooking.bookingNumber}'} during this period.\`);\n  }, [conflictingBooking, returnDate, returnTime, selectedVehicle?.name, showToast, startDate, startTime]);`
  ,
  'booking conflict state'
);

replaceOnce(
  '    if (!customerPhone) return setError("Select or add a customer.");\n    setSaving(true); setError(null);',
  '    if (!customerPhone) return setError("Select or add a customer.");\n    if (conflictingBooking) return setError(`Cannot book this period. ${conflictingBooking.vehicle} is already reserved for ${conflictingBooking.customer} (${conflictingBooking.bookingNumber}) from ${conflictingBooking.start} to ${conflictingBooking.returnDate}.`);\n    setSaving(true); setError(null);',
  'submit conflict guard'
);

replaceOnce(
  '<div className="duration-note"><CalendarRange size={16} /><strong>{days} booked day{days===1?"":"s"}</strong><span>{money(days*rate)} estimated rental</span></div></section>',
  '<div className="duration-note"><CalendarRange size={16} /><strong>{days} booked day{days===1?"":"s"}</strong><span>{money(days*rate)} estimated rental</span></div>{conflictingBooking && <div className="booking-conflict-warning" role="alert"><AlertTriangle size={18} /><div><strong>Selected period is unavailable</strong><p>{selectedVehicle?.name} already has <b>{conflictingBooking.bookingNumber}</b> for <b>{conflictingBooking.customer}</b>.</p><small>{conflictingBooking.start} → {conflictingBooking.returnDate}</small><em>Choose a different date/time before confirming this booking.</em></div></div>}</section>',
  'booking-period conflict warning'
);

replaceOnce(
  'disabled={saving || !selectedVehicle || !customerPhone}>{saving ? "Booking…" : "Confirm booking"}<CalendarDays size={16} />',
  'disabled={saving || !selectedVehicle || !customerPhone || Boolean(conflictingBooking)}>{conflictingBooking ? "Date unavailable" : saving ? "Booking…" : "Confirm booking"}<CalendarDays size={16} />',
  'confirm booking button guard'
);

// Refresh live booking data when the booking dialog opens, reducing stale availability on multi-user use.
replaceOnce(
  '  function openBookingForVehicle(vehicleId: string, date: string) {\n    setBookingSeed({ vehicleId, date });',
  '  function openBookingForVehicle(vehicleId: string, date: string) {\n    void refreshData({ silent: true });\n    setBookingSeed({ vehicleId, date });',
  'vehicle booking opener refresh'
);
replaceOnce(
  '  function newBookingFromTab() {\n    setBookingSeed({ vehicleId: vehicleList[0]?.id ?? "", date: dateInputValue(new Date()) });',
  '  function newBookingFromTab() {\n    void refreshData({ silent: true });\n    setBookingSeed({ vehicleId: vehicleList[0]?.id ?? "", date: dateInputValue(new Date()) });',
  'Bookings tab new booking refresh'
);

if (!css.includes(marker)) {
  css += `\n\n/* ${marker} */\n.booking-conflict-warning {\n  display: flex;\n  align-items: flex-start;\n  gap: 11px;\n  margin-top: 12px;\n  padding: 12px 14px;\n  border: 1px solid rgba(220, 38, 38, .28);\n  border-radius: 12px;\n  background: rgba(254, 242, 242, .92);\n  color: #991b1b;\n}\n.booking-conflict-warning > svg { flex: 0 0 auto; margin-top: 2px; }\n.booking-conflict-warning > div { min-width: 0; display: grid; gap: 3px; }\n.booking-conflict-warning strong { font-size: 13px; color: #7f1d1d; }\n.booking-conflict-warning p,\n.booking-conflict-warning small,\n.booking-conflict-warning em { margin: 0; line-height: 1.45; }\n.booking-conflict-warning p { font-size: 12px; color: #991b1b; }\n.booking-conflict-warning small { font-size: 11px; color: #b91c1c; font-weight: 700; }\n.booking-conflict-warning em { font-size: 11px; color: #7f1d1d; font-style: normal; }\n.confirm-rental:disabled { cursor: not-allowed; opacity: .58; }\n`;
}

fs.writeFileSync(pagePath, page, "utf8");
fs.writeFileSync(cssPath, css, "utf8");
console.log("Booking conflict guard source changes applied.");
'@ | Set-Content -LiteralPath $NodePatch -Encoding utf8

try {
  Write-Host ''
  Write-Host 'Mecardee v8.9.13 - Booking Conflict Guard' -ForegroundColor Cyan
  Write-Host 'Checking selected vehicle/date/time against existing bookings before confirmation.' -ForegroundColor Cyan
  Write-Host "Project: $ProjectPath"
  Write-Host ''

  & node $NodePatch $ProjectPath
  if ($LASTEXITCODE -ne 0) { throw "Source patch failed with exit code $LASTEXITCODE." }

  Push-Location $ProjectPath
  try {
    Write-Host 'Running TypeScript validation...' -ForegroundColor Yellow
    & npx tsc --noEmit
    if ($LASTEXITCODE -ne 0) { throw "TypeScript validation failed with exit code $LASTEXITCODE." }

    Write-Host 'Running production build...' -ForegroundColor Yellow
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw "Production build failed with exit code $LASTEXITCODE." }
  }
  finally { Pop-Location }

  Write-Host ''
  Write-Host 'PATCH COMPLETE' -ForegroundColor Green
  Write-Host '- Existing Booked / On-rent periods are checked immediately.' -ForegroundColor Green
  Write-Host '- Selecting an overlapping date/time shows an Unavailable popup/toast.' -ForegroundColor Green
  Write-Host '- A red warning shows the existing booking number, customer and dates.' -ForegroundColor Green
  Write-Host '- Confirm booking is disabled until the period no longer overlaps.' -ForegroundColor Green
  Write-Host '- The existing server-side overlap check remains as final protection.' -ForegroundColor Green
  Write-Host '- Booking data refreshes when the booking form opens.' -ForegroundColor Green
  Write-Host "Backup: $BackupRoot"
}
catch {
  Write-Host ''
  Write-Host 'Patch failed. Restoring previous files...' -ForegroundColor Red
  $PageBackup = Join-Path $BackupRoot 'app\page.tsx'
  $CssBackup = Join-Path $BackupRoot 'app\globals.css'
  if (Test-Path -LiteralPath $PageBackup) { Copy-Item -LiteralPath $PageBackup -Destination $PagePath -Force }
  if (Test-Path -LiteralPath $CssBackup) { Copy-Item -LiteralPath $CssBackup -Destination $CssPath -Force }
  Write-Host 'Previous files restored.' -ForegroundColor Yellow
  throw
}
finally {
  if (Test-Path -LiteralPath $NodePatch) { Remove-Item -LiteralPath $NodePatch -Force -ErrorAction SilentlyContinue }
}
