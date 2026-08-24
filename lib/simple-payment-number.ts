import { sql, type SQL } from "drizzle-orm";

type SqlExecutor = {
  execute: (query: SQL) => Promise<unknown>;
};

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  if (result && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows?: unknown }).rows;
    return Array.isArray(rows) ? rows as Record<string, unknown>[] : [];
  }
  return [];
}

export function formatSimplePaymentNumber(value: number) {
  if (!Number.isInteger(value) || value < 1) throw new Error("Payment sequence must be a positive whole number.");
  return `PAY-${String(value).padStart(3, "0")}`;
}

/** Allocate a compact payment number safely inside the caller's transaction. */
export async function nextSimplePaymentNumber(tx: SqlExecutor) {
  await tx.execute(sql`
    CREATE TABLE IF NOT EXISTS app_number_counters (
      name varchar(40) PRIMARY KEY,
      next_value bigint NOT NULL
    )
  `);

  const counterName = "payment:PAY";
  await tx.execute(sql`
    INSERT INTO app_number_counters (name, next_value)
    SELECT
      ${counterName},
      greatest(
        1,
        coalesce(max(
          CASE
            WHEN split_part(${sql.raw('"payments"."payment_number"')}, '-', 1) = 'PAY'
              AND split_part(${sql.raw('"payments"."payment_number"')}, '-', 2) ~ '^[0-9]+$'
            THEN split_part(${sql.raw('"payments"."payment_number"')}, '-', 2)::bigint
          END
        ), 0) + 1
      )
    FROM ${sql.raw('"payments"')}
    ON CONFLICT (name) DO NOTHING
  `);

  const result = await tx.execute(sql`
    UPDATE app_number_counters
    SET next_value = next_value + 1
    WHERE name = ${counterName}
    RETURNING next_value - 1 AS value
  `);
  const value = Number(rowsOf(result)[0]?.value);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error("Could not allocate a payment number.");
  return formatSimplePaymentNumber(value);
}
