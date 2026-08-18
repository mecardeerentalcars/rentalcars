import { eq } from "drizzle-orm";
import { DatabaseConfigurationError, withRequestDb } from "@/db";
import { bookings, customers } from "@/db/schema";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { id?: unknown } | null;
    const id = typeof body?.id === "string" ? body.id.trim() : "";

    if (!id || !UUID_PATTERN.test(id)) {
      return Response.json({ ok: false, error: "Customer id is invalid." }, { status: 400 });
    }

    const result = await withRequestDb((db) => db.transaction(async (tx) => {
      const [customer] = await tx
        .select({ id: customers.id, name: customers.name })
        .from(customers)
        .where(eq(customers.id, id))
        .limit(1)
        .for("update");

      if (!customer) return { kind: "not-found" as const };

      const [history] = await tx
        .select({ id: bookings.id })
        .from(bookings)
        .where(eq(bookings.customerId, id))
        .limit(1);

      if (history) {
        return { kind: "history" as const, customer };
      }

      const [deleted] = await tx
        .delete(customers)
        .where(eq(customers.id, id))
        .returning({ id: customers.id, name: customers.name });

      return { kind: "deleted" as const, customer: deleted ?? customer };
    }));

    if (result.kind === "not-found") {
      return Response.json({ ok: false, error: "Customer was not found. Refresh and try again." }, { status: 404 });
    }

    if (result.kind === "history") {
      return Response.json(
        {
          ok: false,
          error: `${result.customer.name} cannot be deleted because booking or rental history is linked to this customer. The history is protected.`,
        },
        { status: 409 },
      );
    }

    return Response.json({ ok: true, customer: result.customer });
  } catch (error) {
    if (error instanceof DatabaseConfigurationError) {
      return Response.json({ ok: false, error: error.message }, { status: 503 });
    }

    const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
    if (code === "23503") {
      return Response.json(
        { ok: false, error: "This customer is linked to rental/payment history and cannot be deleted." },
        { status: 409 },
      );
    }

    console.error("Could not delete customer", error);
    return Response.json({ ok: false, error: "Could not delete the customer." }, { status: 500 });
  }
}
