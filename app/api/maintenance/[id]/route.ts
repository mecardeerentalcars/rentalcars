// MECARDEE_ROLE_GUARD_V8_9_55
import { requireReadAccess, requireWriteAccess, requireSuperAdminAccess } from "@/lib/mecardee-auth";
import { eq } from "drizzle-orm";
import { DatabaseConfigurationError, withRequestDb } from "@/db";
import { maintenanceRecords } from "@/db/schema";

class RequestError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const __mecardeeAuth = await requireWriteAccess();
  if (!__mecardeeAuth.ok) return __mecardeeAuth.response;
  try {
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const values: Record<string, unknown> = { updatedAt: new Date() };

    if ("status" in body) {
      const status = body.status === "open" ? "open" : body.status === "completed" ? "completed" : null;
      if (!status) throw new RequestError("Status must be open or completed.");
      values.status = status;
      values.completedAt = status === "completed" ? new Date() : null;
    }
    if ("title" in body) {
      if (typeof body.title !== "string" || !body.title.trim()) throw new RequestError("Maintenance title is required.");
      values.title = body.title.trim();
    }
    if ("description" in body) values.description = optionalText(body.description);
    if ("dueDate" in body) values.dueDate = optionalDate(body.dueDate);
    if ("dueOdometerKm" in body) values.dueOdometerKm = optionalWhole(body.dueOdometerKm, "Due odometer");
    if ("amount" in body) values.amount = money(body.amount);

    const row = await withRequestDb(async (db) => {
      const [updated] = await db.update(maintenanceRecords)
        .set(values)
        .where(eq(maintenanceRecords.id, id))
        .returning({ id: maintenanceRecords.id });
      return updated;
    });
    if (!row) return Response.json({ ok: false, error: "Maintenance record not found." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof RequestError) return Response.json({ ok: false, error: error.message }, { status: error.status });
    if (error instanceof DatabaseConfigurationError) return Response.json({ ok: false, error: error.message }, { status: 503 });
    console.error("Could not update maintenance record", error);
    return Response.json({ ok: false, error: "Could not update maintenance record." }, { status: 500 });
  }
}
