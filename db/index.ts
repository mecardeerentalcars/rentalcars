import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export class DatabaseConfigurationError extends Error {
  constructor() {
    super(
      "Railway PostgreSQL is not configured. Add DATABASE_URL to .dev.vars locally and to the deployed service environment.",
    );
    this.name = "DatabaseConfigurationError";
  }
}

let pool: Pool | undefined;

export function getPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new DatabaseConfigurationError();
  }

  pool ??= new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 20_000,
    allowExitOnIdle: true,
  });

  return pool;
}

export function getDb() {
  return drizzle(getPool(), { schema });
}
