import { sql, type SQLWrapper } from "drizzle-orm";

export type BookingNumberPrefix = "BKG" | "RNT" | "DRF";

type SqlExecutor = {
  execute: (query: SQLWrapper) => Promise<unknown>;
};

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  if (result && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows?: unknown }).rows;
    return Array.isArray(rows) ? rows as Record<string, unknown>[] : [];
  }
  return [];
}

export function formatSimpleBookingNumber(prefix: BookingNumberPrefix, value: number) {
  if (!Number.isInteger(value) || value < 1) throw new Error("Booking sequence must be a positive whole number.");
  return `${prefix}-${String(value).padStart(3, "0")}`;
}

/**
 * Allocate a compact, concurrency-safe number inside the caller's database
 * transaction. Separate counters keep BKG, RNT and DRF numbers easy to read.
 */
export async function nextSimpleBookingNumber(tx: SqlExecutor, prefix: BookingNumberPrefix) {
  await tx.execute(sql`
    CREATE TABLE IF NOT EXISTS app_number_counters (
      name varchar(40) PRIMARY KEY,
      next_value bigint NOT NULL
    )
  `);

  const counterName = `booking:${prefix}`;
  await tx.execute(sql`
    INSERT INTO app_number_counters (name, next_value)
    SELECT
      ${counterName},
      greatest(
        1,
        coalesce(max(
          CASE
            WHEN split_part(${sql.raw('"bookings"."booking_number"')}, '-', 1) = ${prefix}
              AND split_part(${sql.raw('"bookings"."booking_number"')}, '-', 2) ~ '^[0-9]+$'
            THEN split_part(${sql.raw('"bookings"."booking_number"')}, '-', 2)::bigint
          END
        ), 0) + 1
      )
    FROM ${sql.raw('"bookings"')}
    ON CONFLICT (name) DO NOTHING
  `);

  const result = await tx.execute(sql`
    UPDATE app_number_counters
    SET next_value = next_value + 1
    WHERE name = ${counterName}
    RETURNING next_value - 1 AS value
  `);
  const value = Number(rowsOf(result)[0]?.value);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error("Could not allocate a booking number.");
  return formatSimpleBookingNumber(prefix, value);
}
