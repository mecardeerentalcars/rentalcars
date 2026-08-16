import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  for (const file of [".env", ".dev.vars"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      // Railway injects DATABASE_URL; local environment files are optional.
    }
    if (process.env.DATABASE_URL) break;
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is missing. Add a reference to the PostgreSQL service in Railway Variables.",
  );
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 15_000,
  allowExitOnIdle: true,
});

try {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  console.log("Railway PostgreSQL migrations are up to date.");
} finally {
  await pool.end();
}
