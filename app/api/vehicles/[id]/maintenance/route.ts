// MECARDEE_ROLE_GUARD_V8_9_55
import { requireWriteAccess } from "@/lib/mecardee-auth";
import { eq } from "drizzle-orm";
import { DatabaseConfigurationError, withRequestDb } from "@/db";
import { maintenanceRecords, vehicles } from "@/db/schema";

class RequestError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
const text = (value: unknown, field: string) => {
  if (typeof value !== "string" || !value.trim()) throw new RequestError(`${field} is required.`);
  return value.trim();
};
const optionalText = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
const optionalDate = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RequestError("Due date must be YYYY-MM-DD.");
  return value;
};
const optionalWhole = (value: unknown, field: string) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new RequestError(`${field} must be a positive whole number.`);
  return n;
};
const money = (value: unknown) => {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new RequestError("Amount must be 0 or greater.");
  return Math.round(n * 100) / 100;
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const __mecardeeAuth = await requireWriteAccess();
  if (!__mecardeeAuth.ok) return __mecardeeAuth.response;
  try {
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const title = text(body.title, "Maintenance title");
    const description = optionalText(body.description);
    const dueDate = optionalDate(body.dueDate);
    const dueOdometerKm = optionalWhole(body.dueOdometerKm, "Due odometer");
    const amount = money(body.amount);

    const saved = await withRequestDb(async (db) => {
      const [vehicle] = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, id)).limit(1);
      if (!vehicle) throw new RequestError("Vehicle not found.", 404);
      const [row] = await db.insert(maintenanceRecords)
        .values({ vehicleId: id, title, description, dueDate, dueOdometerKm, amount, status: "open" })
        .returning();
      return row;
    });

    return Response.json({ ok: true, maintenance: saved }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestError) return Response.json({ ok: false, error: error.message }, { status: error.status });
    if (error instanceof DatabaseConfigurationError) return Response.json({ ok: false, error: error.message }, { status: 503 });
    console.error("Could not add maintenance record", error);
    return Response.json({ ok: false, error: "Could not add maintenance record." }, { status: 500 });
  }
}
