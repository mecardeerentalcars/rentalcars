param(
  [Parameter(Mandatory=$true)]
  [string]$ProjectPath
)

$ErrorActionPreference = 'Stop'
$ProjectPath = (Resolve-Path -LiteralPath $ProjectPath).Path
$Payload = Join-Path $PSScriptRoot 'payload'
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupRoot = Join-Path $ProjectPath ".mecardee-patch-backup\v8.9.12-$Stamp"
$Files = @(
  'app\page.tsx',
  'app\globals.css',
  'app\api\snapshot\route.ts',
  'app\api\bookings\[id]\route.ts'
)
$NewFiles = @('app\api\bookings\[id]\route.ts')

function Restore-Backup {
  foreach ($Relative in $Files) {
    $BackupFile = Join-Path $BackupRoot $Relative
    $TargetFile = Join-Path $ProjectPath $Relative
    if (Test-Path -LiteralPath $BackupFile) {
      New-Item -ItemType Directory -Force -Path (Split-Path -Parent $TargetFile) | Out-Null
      Copy-Item -LiteralPath $BackupFile -Destination $TargetFile -Force
    }
    elseif ($NewFiles -contains $Relative) {
      if (Test-Path -LiteralPath $TargetFile) { Remove-Item -LiteralPath $TargetFile -Force }
    }
  }
}

try {
  if (-not (Test-Path -LiteralPath (Join-Path $ProjectPath 'package.json'))) {
    throw "package.json was not found in $ProjectPath"
  }

  $CurrentPagePath = Join-Path $ProjectPath 'app\page.tsx'
  if (-not (Test-Path -LiteralPath $CurrentPagePath)) {
    throw "app\page.tsx was not found in $ProjectPath"
  }
  $CurrentPage = Get-Content -LiteralPath $CurrentPagePath -Raw
  if ($CurrentPage -notmatch 'function FleetStatusPanel' -or $CurrentPage -notmatch 'function NewBookingDialog') {
    throw "This patch expects the recent Mecardee booking-enabled build (v8.9.11 family). Apply the latest Mecardee patch first."
  }

  Write-Host ''
  Write-Host 'Mecardee v8.9.12' -ForegroundColor Cyan
  Write-Host 'Dedicated Bookings tab + list/calendar + filters + booking edit' -ForegroundColor Cyan
  Write-Host "Project: $ProjectPath"
  Write-Host ''

  foreach ($Relative in $Files) {
    $SourceFile = Join-Path $Payload $Relative
    $TargetFile = Join-Path $ProjectPath $Relative
    if (-not (Test-Path -LiteralPath $SourceFile)) { throw "Patch payload is missing: $Relative" }
    if (Test-Path -LiteralPath $TargetFile) {
      $BackupFile = Join-Path $BackupRoot $Relative
      New-Item -ItemType Directory -Force -Path (Split-Path -Parent $BackupFile) | Out-Null
      Copy-Item -LiteralPath $TargetFile -Destination $BackupFile -Force
    }
  }

  foreach ($Relative in $Files) {
    $SourceFile = Join-Path $Payload $Relative
    $TargetFile = Join-Path $ProjectPath $Relative
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $TargetFile) | Out-Null
    Copy-Item -LiteralPath $SourceFile -Destination $TargetFile -Force
  }

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
  Write-Host '- New Bookings item is added between Rentals and Vehicles.' -ForegroundColor Green
  Write-Host '- Sidebar badge shows waiting/upcoming bookings.' -ForegroundColor Green
  Write-Host '- Bookings page includes Today, Upcoming, Active, Completed and Cancelled totals.' -ForegroundColor Green
  Write-Host '- List view includes search, vehicle/status/date filters and compact booking rows.' -ForegroundColor Green
  Write-Host '- Calendar view shows bookings across every occupied date.' -ForegroundColor Green
  Write-Host '- View, Edit, WhatsApp and Start rental actions are available where valid.' -ForegroundColor Green
  Write-Host '- Start rental stays disabled until pickup time and the live vehicle status is Available.' -ForegroundColor Green
  Write-Host '- Editing a future booking re-checks overlap conflicts before saving.' -ForegroundColor Green
  Write-Host '- No database migration is required.' -ForegroundColor Green
  Write-Host "Backup: $BackupRoot"
}
catch {
  Write-Host ''
  Write-Host 'Patch failed. Restoring previous project files...' -ForegroundColor Red
  if (Test-Path -LiteralPath $BackupRoot) { Restore-Backup }
  else {
    foreach ($Relative in $NewFiles) {
      $TargetFile = Join-Path $ProjectPath $Relative
      if (Test-Path -LiteralPath $TargetFile) { Remove-Item -LiteralPath $TargetFile -Force }
    }
  }
  Write-Host 'Previous files restored.' -ForegroundColor Yellow
  throw
}
