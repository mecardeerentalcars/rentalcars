import { and, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";
import { DatabaseConfigurationError, withRequestDb } from "@/db";
import { bookings, payments, returnSettlements, vehicles } from "@/db/schema";
import { calculateExpectedReturnKilometer } from "@/lib/rental-calculations";

type AnyRow = Record<string, unknown>;

class RequestError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const text = (value: unknown, field: string) => {
  if (typeof value !== "string" || !value.trim()) throw new RequestError(`${field} is required.`);
  return value.trim();
};

const dateTime = (value: unknown, field: string) => {
  const valueText = text(value, field);
  const parsed = new Date(valueText);
  if (Number.isNaN(parsed.getTime())) throw new RequestError(`${field} is invalid.`);
  return parsed;
};

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as AnyRow;
    const bookingId = text(body.bookingId, "Rental ID");
    const startAt = dateTime(body.startAt, "Rental start date/time");
    const endAt = dateTime(body.endAt, "Expected return date/time");
    if (endAt <= startAt) throw new RequestError("Expected return must be after the rental start date/time.");

    return await withRequestDb(async (db) => {
      const result = await db.transaction(async (tx) => {
        const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1).for("update");
        if (!booking) throw new RequestError("Rental was not found.", 404);
        if (booking.status !== "rented") {
          throw new RequestError("Only active/on-rent rentals can have their schedule corrected here. Completed rentals stay locked.", 409);
        }

        const [settlement] = await tx.select({ id: returnSettlements.id }).from(returnSettlements).where(eq(returnSettlements.bookingId, bookingId)).limit(1);
        if (settlement) throw new RequestError("This rental already has a Final Settlement and cannot be edited.", 409);

        const [vehicle] = await tx.select().from(vehicles).where(eq(vehicles.id, booking.vehicleId)).limit(1);
        if (!vehicle) throw new RequestError("The linked vehicle no longer exists. Schedule edit was blocked.", 409);

        const [overlap] = await tx.select({ id: bookings.id, number: bookings.bookingNumber }).from(bookings).where(and(
          eq(bookings.vehicleId, booking.vehicleId),
          ne(bookings.id, bookingId),
          inArray(bookings.status, ["booked", "rented"]),
          lt(bookings.startAt, endAt),
          gt(bookings.endAt, startAt),
        )).limit(1);
        if (overlap) throw new RequestError(`The corrected schedule overlaps ${overlap.number}. Change the dates/times first.`, 409);

        const rentalDays = Math.max(1, Math.ceil((endAt.getTime() - startAt.getTime()) / 86_400_000));
        const grossRentalAmount = roundMoney(rentalDays * booking.dailyRate);
        if (booking.bookingDiscount > grossRentalAmount) {
          throw new RequestError("The existing rental discount is greater than the recalculated rent. Reduce the discount before shortening this rental.", 409);
        }
        const baseRentalAmount = roundMoney(grossRentalAmount - booking.bookingDiscount);

        const [paidRow] = await tx.select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)::float8` }).from(payments).where(eq(payments.bookingId, bookingId));
        const paid = Number(paidRow?.total ?? 0);
        const graceDeadline = endAt.getTime() + 3 * 60 * 60 * 1000;
        const lateMs = Math.max(0, Date.now() - graceDeadline);
        const liveLateDays = lateMs > 0 ? Math.ceil(lateMs / 86_400_000) : 0;
        const currentPayable = roundMoney(baseRentalAmount + booking.otherCharges + liveLateDays * booking.dailyRate);
        if (paid > currentPayable + 0.001) {
          throw new RequestError(`The rental already has ₹${paid.toLocaleString("en-IN")} recorded as paid. This schedule would reduce the current bill below that amount, so the edit was blocked.`, 409);
        }

        const expectedReturnKilometer = booking.startingKilometer === null
          ? booking.expectedReturnKilometer
          : calculateExpectedReturnKilometer(booking.startingKilometer, rentalDays, vehicle.allowedKmPerDay);

        await tx.update(bookings).set({
          startAt,
          endAt,
          rentalDays,
          baseRentalAmount,
          expectedReturnKilometer,
          updatedAt: new Date(),
        }).where(eq(bookings.id, bookingId));

        return {
          bookingId,
          bookingNumber: booking.bookingNumber,
          rentalDays,
          baseRentalAmount,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
        };
      });

      return Response.json({ ok: true, rental: result, rentalDays: result.rentalDays, baseRentalAmount: result.baseRentalAmount });
    });
  } catch (error) {
    if (error instanceof RequestError) return Response.json({ ok: false, error: error.message }, { status: error.status });
    if (error instanceof DatabaseConfigurationError) return Response.json({ ok: false, error: error.message }, { status: 503 });
    console.error("Could not edit rental schedule", error);
    return Response.json({ ok: false, error: "Could not update rental schedule." }, { status: 500 });
  }
}
