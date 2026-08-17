import fs from "node:fs/promises";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  for (const file of [".env", ".dev.vars"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      // Railway injects DATABASE_URL. Local env files are optional.
    }
    if (process.env.DATABASE_URL) break;
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing. Add the Railway PostgreSQL DATABASE_URL variable first.");
}

const sql = await fs.readFile(new URL("../sql/mecardee_complete_database.sql", import.meta.url), "utf8");
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 15_000,
  allowExitOnIdle: true,
});

try {
  await pool.query(sql);
  console.log("Mecardee live database schema is ready. Existing data was preserved.");
} finally {
  await pool.end();
}
