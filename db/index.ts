import { drizzle } from "drizzle-orm/node-postgres";
import { Client, Pool } from "pg";
import * as schema from "./schema";

export class DatabaseConfigurationError extends Error {
  constructor() {
    super(
      "Railway PostgreSQL is not configured. Add DATABASE_URL to .dev.vars locally and to the deployed service environment.",
    );
    this.name = "DatabaseConfigurationError";
  }
}

function connectionString() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new DatabaseConfigurationError();
  return value;
}

// Kept for one-off Node scripts such as db/seed.ts. API requests should use
// withRequestDb() below so a Workers/Vinext request never reuses a socket that
// belongs to a previous request context.
let scriptPool: Pool | undefined;

export function getPool() {
  scriptPool ??= new Pool({
    connectionString: connectionString(),
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 20_000,
    allowExitOnIdle: true,
  });
  return scriptPool;
}

export function getDb() {
  return drizzle(getPool(), { schema });
}

export type AppDb = ReturnType<typeof getDb>;

/**
 * Run one HTTP request against one PostgreSQL client and always close it.
 *
 * Vinext local development uses the Cloudflare Workers runtime. Workers tie
 * network I/O objects (including PostgreSQL sockets) to the request that
 * created them, so a module-level pg.Pool can become a stale cross-request
 * socket. A fresh Client per API request is safe locally and also works on
 * Railway without exposing any API key.
 */
export async function withRequestDb<T>(work: (db: AppDb) => Promise<T>): Promise<T> {
  const client = new Client({
    connectionString: connectionString(),
    connectionTimeoutMillis: 10_000,
  });

  await client.connect();
  try {
    const db = drizzle(client, { schema }) as unknown as AppDb;
    return await work(db);
  } finally {
    try {
      await client.end();
    } catch (error) {
      console.error("Could not close PostgreSQL request client", error);
    }
  }
}
