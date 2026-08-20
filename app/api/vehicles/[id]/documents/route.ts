// MECARDEE_ROLE_GUARD_V8_9_55
import { requireReadAccess, requireWriteAccess, requireSuperAdminAccess } from "@/lib/mecardee-auth";
import { and, eq } from "drizzle-orm";
import { DatabaseConfigurationError, withRequestDb } from "@/db";
import { vehicleDocuments, vehicles } from "@/db/schema";

class RequestError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
const text = (value: unknown, field: string) => {
  if (typeof value !== "string" || !value.trim()) throw new RequestError(`${field} is required.`);
  return value.trim();
};
const optionalText = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
const dateOrNull = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RequestError("Expiry date must be YYYY-MM-DD.");
  return value;
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const __mecardeeAuth = await requireWriteAccess();
  if (!__mecardeeAuth.ok) return __mecardeeAuth.response;
  try {
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const documentType = text(body.documentType, "Document type");
    const documentNumber = optionalText(body.documentNumber);
    const expiryDate = dateOrNull(body.expiryDate);
    const notes = optionalText(body.notes);

    const saved = await withRequestDb(async (db) => {
      const [vehicle] = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, id)).limit(1);
      if (!vehicle) throw new RequestError("Vehicle not found.", 404);

      const [existing] = await db.select({ id: vehicleDocuments.id })
        .from(vehicleDocuments)
        .where(and(eq(vehicleDocuments.vehicleId, id), eq(vehicleDocuments.documentType, documentType)))
        .limit(1);

      if (existing) {
        const [row] = await db.update(vehicleDocuments)
          .set({ documentNumber, expiryDate, notes, updatedAt: new Date() })
          .where(eq(vehicleDocuments.id, existing.id))
          .returning();
        return row;
      }

      const [row] = await db.insert(vehicleDocuments)
        .values({ vehicleId: id, documentType, documentNumber, expiryDate, notes })
        .returning();
      return row;
    });

    return Response.json({ ok: true, document: saved });
  } catch (error) {
    if (error instanceof RequestError) return Response.json({ ok: false, error: error.message }, { status: error.status });
    if (error instanceof DatabaseConfigurationError) return Response.json({ ok: false, error: error.message }, { status: 503 });
    console.error("Could not save vehicle document", error);
    return Response.json({ ok: false, error: "Could not save vehicle document." }, { status: 500 });
  }
}
