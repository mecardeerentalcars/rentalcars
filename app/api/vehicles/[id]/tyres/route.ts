import { and, eq, sql } from "drizzle-orm";
import { DatabaseConfigurationError, withRequestDb, type AppDb } from "@/db";
import { vehicleTyres, vehicles } from "@/db/schema";

const POSITIONS = new Set(["front-left", "front-right", "rear-left", "rear-right", "spare"]);
class RequestError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
const requiredPosition = (value: unknown) => {
  if (typeof value !== "string" || !POSITIONS.has(value)) throw new RequestError("Select a valid tyre position.");
  return value;
};
const optionalText = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
const optionalDate = (value: unknown, field: string) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RequestError(`${field} must be YYYY-MM-DD.`);
  return value;
};
const optionalWhole = (value: unknown, field: string) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new RequestError(`${field} must be a whole number.`);
  return n;
};
const optionalNumber = (value: unknown, field: string) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new RequestError(`${field} must be 0 or greater.`);
  return Math.round(n * 100) / 100;
};

async function ensureVehicleTyresTable(db: AppDb) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS vehicle_tyres (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      position varchar(32) NOT NULL,
      brand varchar(120),
      model varchar(120),
      size varchar(64),
      installed_date date,
      installed_odometer_km integer,
      tread_depth_mm numeric(5,2),
      replacement_due_date date,
      replacement_due_odometer_km integer,
      notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS vehicle_tyres_vehicle_position_unique ON vehicle_tyres(vehicle_id, position)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS vehicle_tyres_vehicle_idx ON vehicle_tyres(vehicle_id)`);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const position = requiredPosition(body.position);
    const brand = optionalText(body.brand);
    const model = optionalText(body.model);
    const size = optionalText(body.size);
    const installedDate = optionalDate(body.installedDate, "Installed date");
    const installedOdometerKm = optionalWhole(body.installedOdometerKm, "Installed odometer");
    const treadDepthMm = optionalNumber(body.treadDepthMm, "Tread depth");
    const replacementDueDate = optionalDate(body.replacementDueDate, "Replacement due date");
    const replacementDueOdometerKm = optionalWhole(body.replacementDueOdometerKm, "Replacement due odometer");
    const notes = optionalText(body.notes);

    const saved = await withRequestDb(async (db) => {
      const [vehicle] = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, id)).limit(1);
      if (!vehicle) throw new RequestError("Vehicle not found.", 404);

      // A tyre save can self-heal a database that has not received the latest
      // additive migration yet. This avoids blocking the rest of the vehicle UI.
      await ensureVehicleTyresTable(db);

      const [existing] = await db.select({ id: vehicleTyres.id })
        .from(vehicleTyres)
        .where(and(eq(vehicleTyres.vehicleId, id), eq(vehicleTyres.position, position)))
        .limit(1);

      const values = { brand, model, size, installedDate, installedOdometerKm, treadDepthMm, replacementDueDate, replacementDueOdometerKm, notes, updatedAt: new Date() };
      if (existing) {
        const [row] = await db.update(vehicleTyres).set(values).where(eq(vehicleTyres.id, existing.id)).returning();
        return row;
      }
      const [row] = await db.insert(vehicleTyres).values({ vehicleId: id, position, ...values }).returning();
      return row;
    });

    return Response.json({ ok: true, tyre: saved });
  } catch (error) {
    if (error instanceof RequestError) return Response.json({ ok: false, error: error.message }, { status: error.status });
    if (error instanceof DatabaseConfigurationError) return Response.json({ ok: false, error: error.message }, { status: 503 });
    console.error("Could not save tyre details", error);
    const message = process.env.NODE_ENV === "development" && error instanceof Error
      ? `Could not save tyre details. ${error.message}`
      : "Could not save tyre details.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
