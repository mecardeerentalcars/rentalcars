import { eq, inArray } from "drizzle-orm";
import { DatabaseConfigurationError, withRequestDb } from "@/db";
import { bookings, customers, payments } from "@/db/schema";

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

      const customerBookings = await tx
        .select({ id: bookings.id, status: bookings.status, number: bookings.bookingNumber })
        .from(bookings)
        .where(eq(bookings.customerId, id));

      // "Rental history" means the booking actually became a rental or was completed.
      // Those customer records are protected permanently.
      const rentalHistory = customerBookings.find((booking) =>
        booking.status === "rented" || booking.status === "completed"
      );

      if (rentalHistory) {
        return {
          kind: "rental-history" as const,
          customer,
          bookingNumber: rentalHistory.number,
        };
      }

      const bookingIds = customerBookings.map((booking) => booking.id);

      // Booking-only history is allowed to be removed with the customer.
      // Payments tied only to those not-yet-rented bookings must be removed first
      // because the database foreign keys intentionally use ON DELETE RESTRICT.
      if (bookingIds.length) {
        await tx.delete(payments).where(inArray(payments.bookingId, bookingIds));
        await tx.delete(bookings).where(inArray(bookings.id, bookingIds));
      }

      // Defensive cleanup for any customer payment row that was not returned above.
      // This is safe here because rental/completed history was already blocked.
      await tx.delete(payments).where(eq(payments.customerId, id));

      const [deleted] = await tx
        .delete(customers)
        .where(eq(customers.id, id))
        .returning({ id: customers.id, name: customers.name });

      return {
        kind: "deleted" as const,
        customer: deleted ?? customer,
        removedBookings: bookingIds.length,
      };
    }));

    if (result.kind === "not-found") {
      return Response.json({ ok: false, error: "Customer was not found. Refresh and try again." }, { status: 404 });
    }

    if (result.kind === "rental-history") {
      return Response.json(
        {
          ok: false,
          error: `${result.customer.name} cannot be deleted because rental history exists${result.bookingNumber ? ` (${result.bookingNumber})` : ""}. Customers with rental history are protected.`,
        },
        { status: 409 },
      );
    }

    return Response.json({
      ok: true,
      customer: result.customer,
      removedBookings: result.removedBookings,
    });
  } catch (error) {
    if (error instanceof DatabaseConfigurationError) {
      return Response.json({ ok: false, error: error.message }, { status: 503 });
    }

    const code = typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";

    if (code === "23503") {
      return Response.json(
        {
          ok: false,
          error: "This customer still has protected rental-linked history and cannot be deleted.",
        },
        { status: 409 },
      );
    }

    console.error("Could not delete customer", error);
    return Response.json({ ok: false, error: "Could not delete the customer." }, { status: 500 });
  }
}
