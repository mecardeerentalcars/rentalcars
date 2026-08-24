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
  assert.match(page, /Reopen completed return/);
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
  assert.match(page, /const changedRentals/);
  assert.match(page, /vehicle\.isGuest \? "Excluded"/);
  assert.match(snapshot, /segment\.rentalCharge \+ segment\.extraKmCharge \+ segment\.fuelCharge/);
});

test("keeps settlement, schedule, and report corrections wired through every entry point", async () => {
  const [page, snapshot, settlement, extension, paymentAdmin] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/snapshot/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/settlements/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/extensions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/settings/transactions/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /normalisePendingBalance\(roundedFinalAmount - rental\.paid\)/);
  assert.match(page, /customerReportDateOnly\(rental\.actualReturnAt \|\| rental\.endAt\)/);
  assert.match(page, /const segmentStart = indiaDateKey\(segment\.startAt\)/);
  assert.match(snapshot, /const balance = normalisePendingBalance\(total - paid\)/);
  assert.match(settlement, /storedCurrentRentalDays/);
  assert.match(extension, /activeSegmentProjection\?\.rentalDays/);
  assert.match(paymentAdmin, /const replacementFlow/);
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
  assert.match(styles, /\.final-return-confirm input:checked/);
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
