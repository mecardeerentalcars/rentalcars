import { eq } from "drizzle-orm";
import { DatabaseConfigurationError, withRequestDb } from "@/db";
import { customers } from "@/db/schema";

type CustomerBody = { name?: unknown; phone?: unknown; whatsappNumber?: unknown; drivingLicence?: unknown; city?: unknown };
class RequestError extends Error { constructor(message: string, readonly status = 400) { super(message); } }
const text = (value: unknown, field: string) => { if (typeof value !== "string" || !value.trim()) throw new RequestError(`${field} is required.`); return value.trim(); };
const optionalText = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CustomerBody;
    const name = text(body.name, "Customer name");
    const phone = text(body.phone, "Phone");
    const drivingLicence = text(body.drivingLicence, "Driving licence");
    const whatsappNumber = optionalText(body.whatsappNumber) ?? phone;
    const city = optionalText(body.city);

    const saved = await withRequestDb(async (db) => {
      const [duplicate] = await db.select({ id: customers.id }).from(customers).where(eq(customers.phone, phone)).limit(1);
      if (duplicate) throw new RequestError("A customer with this phone number already exists.", 409);
      const [customer] = await db
        .insert(customers)
        .values({ name, phone, whatsappNumber, drivingLicence, city })
        .returning({ id: customers.id, name: customers.name, phone: customers.phone });
      if (!customer) throw new Error("PostgreSQL did not return the created customer.");
      return customer;
    });

    return Response.json({ ok: true, customer: saved }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestError) return Response.json({ ok: false, error: error.message }, { status: error.status });
    if (error instanceof DatabaseConfigurationError) return Response.json({ ok: false, error: error.message }, { status: 503 });
    console.error("Could not save customer", error);
    return Response.json({ ok: false, error: "Could not save the customer." }, { status: 500 });
  }
}
