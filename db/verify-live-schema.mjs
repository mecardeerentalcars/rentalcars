// MECARDEE_RENTAL_EXPENSES_PAYMENTS_HUB_V8_9_81
// MECARDEE_SEGMENT_FUEL_FINAL_SETTLEMENT_V8_9_45
import pg from "pg";

if (!process.env.DATABASE_URL) {
  for (const file of [".dev.vars", ".env.local", ".env"]) {
    try { process.loadEnvFile(file); } catch {}
    if (process.env.DATABASE_URL) break;
  }
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing.");

const tables = [
  "vehicles",
  "customers",
  "bookings",
  "rental_segments",
  "return_settlements",
  "payments",
  "rental_extensions",
  "expenses",
  "vehicle_documents",
  "maintenance_records",
  "vehicle_tyres",
];
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 15_000, allowExitOnIdle: true });
try {
  const found = await pool.query(
    "select table_name from information_schema.tables where table_schema = 'public' and table_name = any($1::text[]) order by table_name",
    [tables],
  );
  const present = new Set(found.rows.map((row) => row.table_name));
  const missing = tables.filter((table) => !present.has(table));
  if (missing.length) throw new Error(`Database verification failed. Missing tables: ${missing.join(", ")}`);
  const guestColumn = await pool.query(
    "select 1 from information_schema.columns where table_schema = 'public' and table_name = 'vehicles' and column_name = 'is_guest'",
  );
  if (!guestColumn.rowCount) throw new Error("Database verification failed. vehicles.is_guest is missing.");
  const requestedVehicleColumn = await pool.query(
    "select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bookings' and column_name = 'requested_vehicle_id'",
  );
  if (!requestedVehicleColumn.rowCount) throw new Error("Database verification failed. bookings.requested_vehicle_id is missing.");
  const expenseBookingColumn = await pool.query(
    "select 1 from information_schema.columns where table_schema = 'public' and table_name = 'expenses' and column_name = 'booking_id'",
  );
  if (!expenseBookingColumn.rowCount) throw new Error("Database verification failed. expenses.booking_id is missing.");

  const rentalSegmentFuelColumns = await pool.query(
    "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'rental_segments' and column_name = any($1::text[])",
    [["return_fuel_range_km", "fuel_range_shortage_km", "fuel_price_per_litre", "fuel_charge"]],
  );
  const rentalSegmentFuelPresent = new Set(rentalSegmentFuelColumns.rows.map((row) => row.column_name));
  const rentalSegmentFuelMissing = ["return_fuel_range_km", "fuel_range_shortage_km", "fuel_price_per_litre", "fuel_charge"]
    .filter((column) => !rentalSegmentFuelPresent.has(column));
  if (rentalSegmentFuelMissing.length) {
    throw new Error(`Database verification failed. rental_segments fuel columns missing: ${rentalSegmentFuelMissing.join(", ")}`);
  }

  for (const table of tables) {
    const result = await pool.query(`select count(*)::int as count from ${table}`);
    console.log(`${table}: ${result.rows[0].count} rows`);
  }
  console.log("Mecardee live database verification passed: all 11 tables, booking/requested-vehicle fields, rental-linked expenses, and rental-segment fuel fields are available.");
} finally {
  await pool.end();
}
