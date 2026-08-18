import { and, eq, gt, inArray, lt, ne } from "drizzle-orm";
import { DatabaseConfigurationError, withRequestDb } from "@/db";
import { bookings, customers, payments, vehicles } from "@/db/schema";
import { calculateExpectedReturnKilometer } from "@/lib/rental-calculations";

class RequestError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
const amount = (value: unknown, field: string) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new RequestError(`${field} must be zero or greater.`);
  return Math.round(number * 100) / 100;
};
const whole = (value: unknown, field: string) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new RequestError(`${field} must be a whole number of zero or greater.`);
  return number;
};
const text = (value: unknown, field: string) => {
  if (typeof value !== "string" || !value.trim()) throw new RequestError(`${field} is required.`);
  return value.trim();
};
const date = (value: unknown, field: string) => {
  const result = new Date(text(value, field));
  if (Number.isNaN(result.getTime())) throw new RequestError(`${field} is invalid.`);
  return result;
};
const numberId = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "").toLowerCase();

    const result = await withRequestDb((db) => db.transaction(async (tx) => {
      const [record] = await tx.select({ booking: bookings, vehicle: vehicles, customer: customers })
        .from(bookings)
        .innerJoin(vehicles, eq(bookings.vehicleId, vehicles.id))
        .innerJoin(customers, eq(bookings.customerId, customers.id))
        .where(eq(bookings.id, id)).limit(1).for("update");
      if (!record) throw new RequestError("Booking was not found.", 404);
      if (record.booking.status !== "booked") throw new RequestError("Only an active booking can be changed here.", 409);

      if (action === "cancel") {
        await tx.update(bookings).set({ status: "cancelled", updatedAt: new Date() }).where(eq(bookings.id, id));
        return { action: "cancelled", bookingNumber: record.booking.bookingNumber };
      }

      if (action === "edit") {
        const startAt = date(body.startAt, "Start date");
        const endAt = date(body.endAt, "Return date");
        const rentalDays = whole(body.rentalDays, "Rental days");
        const dailyRate = amount(body.dailyRate, "Daily rate");
        if (rentalDays < 1) throw new RequestError("Rental days must be at least 1.");
        if (endAt <= startAt) throw new RequestError("Return date must be after the start date.");

        const [overlap] = await tx.select({ id: bookings.id }).from(bookings).where(and(
          eq(bookings.vehicleId, record.vehicle.id),
          ne(bookings.id, id),
          inArray(bookings.status, ["booked", "rented"]),
          lt(bookings.startAt, endAt),
          gt(bookings.endAt, startAt),
        )).limit(1);
        if (overlap) throw new RequestError("Vehicle is already booked or on rent for the selected period.", 409);

        await tx.update(bookings).set({
          startAt,
          endAt,
          rentalDays,
          dailyRate,
          baseRentalAmount: Math.round(rentalDays * dailyRate * 100) / 100,
          updatedAt: new Date(),
        }).where(eq(bookings.id, id));
        return { action: "edited", bookingNumber: record.booking.bookingNumber };
      }

      if (action !== "start") throw new RequestError("Booking action is invalid.");
      if (record.vehicle.status !== "available") throw new RequestError("Vehicle must be available before this booking can be started.", 409);

      const startingKilometer = whole(body.startingKilometer, "Starting kilometer");
      const startingFuelRangeKm = whole(body.startingFuelRangeKm, "Starting fuel range");
      const dailyRate = amount(body.dailyRate ?? record.booking.dailyRate, "Daily rate");
      const securityDeposit = amount(body.securityDeposit ?? 0, "Security deposit");
      const advancePaid = amount(body.advancePaid ?? 0, "Advance paid");
      const bookingDiscount = amount(body.bookingDiscount ?? 0, "Discount");
      const gross = Math.round(record.booking.rentalDays * dailyRate * 100) / 100;
      if (bookingDiscount > gross) throw new RequestError("Discount cannot exceed the rental amount.");
      const total = Math.round((gross - bookingDiscount) * 100) / 100;
      if (advancePaid > total) throw new RequestError("Advance cannot exceed the rental total.");
      const expectedReturnKilometer = calculateExpectedReturnKilometer(startingKilometer, record.booking.rentalDays, record.vehicle.allowedKmPerDay);

      await tx.update(bookings).set({
        dailyRate,
        baseRentalAmount: total,
        bookingDiscount,
        advancePaid,
        securityDeposit,
        startingKilometer,
        startingFuelRangeKm,
        expectedReturnKilometer,
        status: "rented",
        handedOverAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(bookings.id, id));

      if (advancePaid > 0) {
        await tx.insert(payments).values({
          paymentNumber: numberId("PAY"),
          bookingId: record.booking.id,
          customerId: record.customer.id,
          amount: advancePaid,
          method: text(body.paymentMethod ?? "UPI", "Payment method"),
          paymentType: "advance",
          notes: `Advance for ${record.booking.bookingNumber}`,
          receivedBy: typeof body.receivedBy === "string" && body.receivedBy.trim() ? body.receivedBy.trim() : "Admin",
          receivedAt: new Date(),
        });
      }
      await tx.update(vehicles).set({ status: "rented", odometerKm: startingKilometer, updatedAt: new Date() }).where(eq(vehicles.id, record.vehicle.id));
      return { action: "started", bookingNumber: record.booking.bookingNumber };
    }));

    return Response.json({ ok: true, result });
  } catch (error) {
    if (error instanceof RequestError) return Response.json({ ok: false, error: error.message }, { status: error.status });
    if (error instanceof DatabaseConfigurationError) return Response.json({ ok: false, error: error.message }, { status: 503 });
    console.error("Could not update booking", error);
    return Response.json({ ok: false, error: "Could not update the booking." }, { status: 500 });
  }
}
