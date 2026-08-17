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
  for (const table of tables) {
    const result = await pool.query(`select count(*)::int as count from ${table}`);
    console.log(`${table}: ${result.rows[0].count} rows`);
  }
  console.log("Mecardee live database verification passed: all 10 tables are available.");
} finally {
  await pool.end();
}
