import { eq, sql } from "drizzle-orm";
import { DatabaseConfigurationError, getDb } from "@/db";
import { bookings, customers, payments, returnSettlements } from "@/db/schema";

type PaymentBody = {
  bookingNumber?: unknown;
  amount?: unknown;
  method?: unknown;
  notes?: unknown;
};

class RequestError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const text = (value: unknown, field: string) => {
  if (typeof value !== "string" || !value.trim()) throw new RequestError(`${field} is required.`);
  return value.trim();
};
const optionalText = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const money = (value: unknown, field: string) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new RequestError(`${field} must be greater than zero.`);
  return Math.round(number * 100) / 100;
};
const numberId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PaymentBody;
    const bookingNumber = text(body.bookingNumber, "Booking number");
    const receivedAmount = money(body.amount, "Payment amount");
    const method = text(body.method, "Payment method");
    const notes = optionalText(body.notes);

    const result = await getDb().transaction(async (tx) => {
      const [record] = await tx
        .select({ booking: bookings, customer: customers })
        .from(bookings)
        .innerJoin(customers, eq(bookings.customerId, customers.id))
        .where(eq(bookings.bookingNumber, bookingNumber))
        .limit(1)
        .for("update");
      if (!record) throw new RequestError("Rental booking was not found.", 404);
      if (record.booking.status === "draft") throw new RequestError("Draft rentals cannot receive payments.", 409);

      const [settlement] = await tx
        .select({ finalAmount: returnSettlements.finalAmount })
        .from(returnSettlements)
        .where(eq(returnSettlements.bookingId, record.booking.id))
        .limit(1);
      const [paidRow] = await tx
        .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)::float8` })
        .from(payments)
        .where(eq(payments.bookingId, record.booking.id));
      const alreadyPaid = Number(paidRow?.total ?? 0);
      const total = Number(settlement?.finalAmount ?? record.booking.baseRentalAmount + record.booking.otherCharges);
      const balance = Math.max(0, Math.round((total - alreadyPaid) * 100) / 100);
      if (balance <= 0) throw new RequestError("This rental is already fully paid.", 409);
      if (receivedAmount > balance) {
        throw new RequestError(`Payment cannot exceed the current balance of ₹${balance.toLocaleString("en-IN")}.`);
      }

      const [saved] = await tx
        .insert(payments)
        .values({
          paymentNumber: numberId("PAY"),
          bookingId: record.booking.id,
          customerId: record.customer.id,
          amount: receivedAmount,
          method,
          paymentType: "rental",
          notes,
          receivedBy: "Ajmal",
          receivedAt: new Date(),
        })
        .returning();
      await tx.update(bookings).set({ updatedAt: new Date() }).where(eq(bookings.id, record.booking.id));
      return {
        paymentNumber: saved.paymentNumber,
        amount: saved.amount,
        balance: Math.max(0, Math.round((balance - receivedAmount) * 100) / 100),
      };
    });

    return Response.json({ ok: true, payment: result }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestError) return Response.json({ ok: false, error: error.message }, { status: error.status });
    if (error instanceof DatabaseConfigurationError) return Response.json({ ok: false, error: error.message }, { status: 503 });
    console.error("Could not record payment", error);
    return Response.json({ ok: false, error: "Could not record the payment." }, { status: 500 });
  }
}
