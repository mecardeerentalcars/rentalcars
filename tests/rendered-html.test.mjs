import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Mecardee authenticated app bootstrap", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Mecardee — Rental management, made simple<\/title>/i);
  assert.match(html, /mecardee-auth-screen-bootstrap/i);
  assert.match(html, /mecardee-first-paint/i);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/i);
});

test("keeps the frontend product-specific and starter-free", async () => {
  const previewRoot = new URL("../app/_sites-preview/", import.meta.url);
  const [page, layout, packageJson, previewFiles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readdir(previewRoot).catch(() => []),
  ]);

  assert.deepEqual(previewFiles, []);
  assert.match(page, /"use client";/);
  assert.match(page, /function NewRentalDialog/);
  assert.match(page, /function ReturnDialog/);
  assert.match(page, /function AccountsView/);
  assert.match(page, /Edit settlement/);
  assert.match(page, /Update settlement/);
  assert.doesNotMatch(page, /Reopen to on rent/);
  assert.match(page, /dashboard-status-line/);
  assert.match(page, /Vehicle has physically returned/);
  assert.match(page, /Enter return details/);
  assert.match(page, /Extra KM used/);
  assert.match(page, /Enter 0 when the dashboard shows no remaining fuel range/);
  assert.match(page, /Send settlement on WhatsApp/);
  assert.match(page, /buildSettlementWhatsAppMessage/);
  assert.match(layout, /Mecardee — Rental management, made simple/);
  assert.match(layout, /\/og-ai\.png/);
  assert.match(packageJson, /"lucide-react"/);
  assert.doesNotMatch(`${page}\n${layout}\n${packageJson}`, /codex-preview|SkeletonPreview|react-loading-skeleton/);
});

test("reports vehicle replacements and excludes Guest Car finances", async () => {
  const [page, snapshot] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/snapshot/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Vehicle usage \/ changes/);
  assert.match(page, /KM by vehicle/);
  assert.match(page, /if \(segments\.length <= 1\) return "—"/);
  assert.match(page, /const entriesByRental/);
  assert.match(page, /customerWithPlace\(rental\.customer, rental\.city\)/);
  assert.match(page, /headers: \["Vehicle", "Registration", "Rental", "Customer", "Rental dates", "KM run", "Change details", "Period revenue"\]/);
  assert.doesNotMatch(page, /headers: \["Vehicle", "Registration", "Type", "Customer \/ rental"/);
  assert.match(page, /vehicle\.isGuest \? "\\nGuest Car"/);
  assert.match(page, /vehicle\.isGuest \? "Excluded"/);
  assert.match(page, /const rentalOverlapsPeriod = \(rental: Rental\) => overlapsReportPeriod/);
  assert.match(page, /segmentCharge\(segment\) \* overlapRatio\(segment\.startAt, segment\.endAt/);
  assert.match(page, /rental\.businessFinancialTotal \* periodVehicleShare\(rental, vehicle\.id\)/);
  assert.match(snapshot, /segment\.rentalCharge \+ segment\.extraKmCharge \+ segment\.fuelCharge/);
  assert.doesNotMatch(snapshot, /\.slice\(0,\s*100\)/);
});

test("keeps settlement, schedule, and report corrections wired through every entry point", async () => {
  const [page, snapshot, settlement, extension, paymentAdmin, rentalAdmin] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/snapshot/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/settlements/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/extensions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/settings/transactions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/settings/rentals/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /normalisePendingBalance\(roundedFinalAmount - rental\.paid\)/);
  assert.match(page, /customerReportDateOnly\(rental\.actualReturnAt \|\| rental\.endAt\)/);
  assert.match(page, /const segmentStart = indiaDateKey\(segment\.startAt\)/);
  assert.match(snapshot, /const balance = normalisePendingBalance\(total - paid\)/);
  assert.match(settlement, /storedCurrentRentalDays/);
  assert.match(settlement, /export async function PATCH\(request: Request\)/);
  assert.match(settlement, /Only a completed rental settlement can be edited/);
  assert.match(settlement, /!newerVehicleSegment/);
  assert.match(page, /method: editCompleted \? "PATCH" : "POST"/);
  assert.match(page, /confirmed\.calculation\.amountDue/);
  assert.match(page, /aria-pressed=\{physicalReturnConfirmed\}/);
  assert.match(page, /useState<number>\(savedSettlement\?\.actualReturnKilometer \?\? 0\)/);
  assert.match(page, /setManualActualReturnKilometer\(0\)/);
  assert.match(extension, /activeSegmentProjection\?\.rentalDays/);
  assert.match(paymentAdmin, /const replacementFlow/);
  assert.equal(
    rentalAdmin.match(/const rentalDays = rentalDaysFromSchedule\(startAt, endAt\);/g)?.length,
    2,
    "both rental schedule correction paths must use the shared India-calendar rule",
  );
  assert.doesNotMatch(rentalAdmin, /Math\.ceil\(\(endAt\.getTime\(\) - startAt\.getTime\(\)\) \/ 86_400_000\)/);
});

test("active notifications refresh, resolve from current data, and only render below the bell", async () => {
  const [page, snapshot] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/snapshot/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /window\.setInterval\(refreshWhenVisible, 60_000\)/);
  assert.match(page, /document\.addEventListener\("visibilitychange", refreshWhenVisible\)/);
  assert.match(page, /window\.addEventListener\("online", refreshWhenVisible\)/);
  assert.match(page, /No active notifications right now\./);
  assert.equal(page.match(/reminders=\{reminders\}/g)?.length, 2, "reminders should render in dashboard and bell panel");
  assert.doesNotMatch(page, /NotificationHistory|notificationHistory|Smart reminders/);

  assert.match(snapshot, /rental\.state === "completed" && rental\.balance > 0/);
  assert.match(snapshot, /if \(record\.status !== "open"\) continue/);
  assert.match(snapshot, /key: `document:\$\{document\.id\}:\$\{document\.expiryDate\}`/);
  assert.match(snapshot, /key: `maintenance:\$\{record\.id\}:/);
  assert.match(snapshot, /key: `tyre:\$\{tyre\.id\}:/);
  assert.doesNotMatch(snapshot, /reminders\.slice\(0,\s*12\)/);
});

test("critical startup paths retain old Samsung Chrome and iPhone compatibility", async () => {
  const [page, layout, serviceWorker, viteConfig] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
  ]);

  assert.match(viteConfig, /target: \["chrome64", "edge79", "firefox67", "safari11\.1"\]/);
  assert.match(layout, /body\.mecardee-client-ready \.mecardee-first-paint/);
  assert.match(page, /document\.body\.classList\.add\("mecardee-client-ready"\)/);
  assert.match(page, /import\("pdfmake\/build\/pdfmake"\)/);
  assert.doesNotMatch(page, /import pdfMake from "pdfmake/);
  assert.doesNotMatch(page, /\.replaceAll\(|\.flatMap\(|\.at\(|Object\.fromEntries\(/);
  assert.doesNotMatch(serviceWorker, /\?\./, "the untranspiled service worker must not use optional chaining");
});

test("mobile return controls, vehicle image navigation, and payment report fields remain connected", async () => {
  const [page, styles, vehicleEditor, snapshot] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/vehicles/[id]/vehicle-details-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/snapshot/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /className="vehicle-image-open"/);
  assert.match(page, /maintenance-check-state/);
  assert.match(page, /"Associated rental", "Vehicle"/);
  assert.match(page, /"Entered by"/);
  assert.match(page, /effectiveBookingCalendarEndAt/);
  assert.doesNotMatch(page, /dayBookings\.slice/);
  assert.doesNotMatch(page, /dashboard-calendar-more/);
  assert.doesNotMatch(page, /booking-more/);
  assert.match(styles, /\.vehicle-photo > \.vehicle-image-open/);
  assert.match(styles, /\.final-return-confirm\.is-checked > span/);
  assert.match(styles, /touch-action: manipulation/);
  assert.match(vehicleEditor, /operationalStatusEditor/);
  assert.match(snapshot, /place: customer\.city/);
  assert.match(snapshot, /vehicle: vehicleLabels\.join/);
  assert.match(page, /headers: \["Customer", "Phone", "Rental", "Rental dates", "Vehicle usage \/ changes", "KM by vehicle"/);
  assert.match(page, /const rows = \[\.\.\.filteredRentals\]/);
  assert.doesNotMatch(page, /const grouped = new Map<string, Rental\[\]>/);
  assert.doesNotMatch(page, /className="booking-brief-actions"/);
  assert.match(page, /if \(segments\.length <= 1\) return "—"/);
  assert.match(page, /segment\.vehicle.*customerReportDateOnly\(segment\.startAt\).*usedKm/s);
  assert.match(page, /async function manualSync\(\).*await refreshData\(\);.*window\.location\.reload\(\);/s);
  assert.match(styles, /MECARDEE_STICKY_COMPACT_MOBILE_DASHBOARD/);
  assert.match(styles, /\.mobile-search-slot \{.*position: sticky/s);
});

test("change-vehicle KM, rate, and Guest Car report controls stay connected", async () => {
  const [page, styles, changeVehicle] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/rentals/change-vehicle/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /const \[endingKilometer, setEndingKilometer\] = useState\(0\)/);
  assert.match(page, /Total run KM/);
  assert.match(page, /nextStartingFuelRangeKm, nextDailyRate/);
  assert.match(page, /setNextDailyRate\(nextVehicle\.rate\)/);
  assert.match(changeVehicle, /dailyRate: nextDailyRate/);
  assert.match(changeVehicle, /New vehicle daily rate must be greater than zero/);
  const guestReport = page.match(/function GuestCarsView[\s\S]*?function customerPhoneKey/)?.[0] ?? "";
  assert.doesNotMatch(guestReport, /View rental/);
  assert.match(guestReport, /guest-return-value/);
  assert.match(styles, /\.guest-usage-values \.guest-return-value/);
});
