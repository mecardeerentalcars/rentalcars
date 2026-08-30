// MECARDEE_ROLE_GUARD_V8_9_55
import { requireWriteAccess } from "@/lib/mecardee-auth";
import { and, eq, ne } from "drizzle-orm";
import { DatabaseConfigurationError, withRequestDb } from "@/db";
import { customers } from "@/db/schema";

type UpdateCustomerBody = {
  name?: unknown;
  phone?: unknown;
  whatsappNumber?: unknown;
  drivingLicence?: unknown;
  city?: unknown;
};

class RequestError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

const requiredText = (value: unknown, field: string) => {
  if (typeof value !== "string" || !value.trim()) throw new RequestError(`${field} is required.`);
  return value.trim();
};
const optionalText = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const __mecardeeAuth = await requireWriteAccess();
  if (!__mecardeeAuth.ok) return __mecardeeAuth.response;
  try {
    const { id } = await context.params;
    const body = await request.json() as UpdateCustomerBody;
    const name = requiredText(body.name, "Customer name");
    const phone = requiredText(body.phone, "Phone");
    const whatsappNumber = optionalText(body.whatsappNumber) ?? phone;
    const drivingLicence = optionalText(body.drivingLicence) ?? "";
    const city = optionalText(body.city);

    const saved = await withRequestDb(async (db) => {
      const [existing] = await db.select({ id: customers.id }).from(customers).where(eq(customers.id, id)).limit(1);
      if (!existing) throw new RequestError("Customer was not found.", 404);

      const [duplicate] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.phone, phone), ne(customers.id, id)))
        .limit(1);
      if (duplicate) throw new RequestError("Another customer already uses this phone number.", 409);

      const [customer] = await db
        .update(customers)
        .set({ name, phone, whatsappNumber, drivingLicence, city, updatedAt: new Date() })
        .where(eq(customers.id, id))
        .returning({ id: customers.id, name: customers.name, phone: customers.phone });
      if (!customer) throw new Error("PostgreSQL did not return the updated customer.");
      return customer;
    });

    return Response.json({ ok: true, customer: saved });
  } catch (error) {
    if (error instanceof RequestError) return Response.json({ ok: false, error: error.message }, { status: error.status });
    if (error instanceof DatabaseConfigurationError) return Response.json({ ok: false, error: error.message }, { status: 503 });
    console.error("Could not update customer", error);
    return Response.json({ ok: false, error: "Could not update the customer." }, { status: 500 });
  }
}
