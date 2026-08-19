import { and, desc, eq, gt, lt, ne, sql } from "drizzle-orm";
import { DatabaseConfigurationError, withRequestDb } from "@/db";
import { bookings, payments, rentalSegments, returnSettlements, vehicles } from "@/db/schema";
import { calculateExpectedReturnKilometer } from "@/lib/rental-calculations";
import { calculateSegmentCharge } from "@/lib/rental-segments";

type AnyRow = Record<string, unknown>;
class RequestError extends Error { constructor(message: string, readonly status = 400) { super(message); } }
const text = (value: unknown, field: string) => { if (typeof value !== "string" || !value.trim()) throw new RequestError(`${field} is required.`); return value.trim(); };
const dateTime = (value: unknown, field: string) => { const parsed = new Date(text(value, field)); if (Number.isNaN(parsed.getTime())) throw new RequestError(`${field} is invalid.`); return parsed; };
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
        if (booking.status !== "rented") throw new RequestError("Only active/on-rent rentals can have their schedule corrected here. Completed rentals stay locked.", 409);

        const [settlement] = await tx.select({ id: returnSettlements.id }).from(returnSettlements).where(eq(returnSettlements.bookingId, bookingId)).limit(1);
        if (settlement) throw new RequestError("This rental already has a Final Settlement and cannot be edited.", 409);

        const segments = await tx.select().from(rentalSegments).where(eq(rentalSegments.bookingId, bookingId)).orderBy(rentalSegments.sequence);
        const activeSegment = [...segments].reverse().find((segment) => segment.status === "active") ?? null;
        const actualVehicleId = activeSegment?.vehicleId ?? booking.vehicleId;
        const [vehicle] = await tx.select().from(vehicles).where(eq(vehicles.id, actualVehicleId)).limit(1);
        if (!vehicle) throw new RequestError("The currently assigned vehicle no longer exists. Schedule edit was blocked.", 409);
        if (activeSegment && endAt.getTime() <= activeSegment.startAt.getTime()) throw new RequestError("Expected return must be after the current vehicle segment started.", 409);

        // Protect every future booking for the vehicle that is actually being used now.
        const [bookingOverlap] = await tx.select({ id: bookings.id, number: bookings.bookingNumber }).from(bookings).where(and(
          eq(bookings.vehicleId, actualVehicleId),
          ne(bookings.id, bookingId),
          eq(bookings.status, "booked"),
          lt(bookings.startAt, endAt),
          gt(bookings.endAt, activeSegment?.startAt ?? startAt),
        )).limit(1);
        if (bookingOverlap) throw new RequestError(`The corrected schedule overlaps ${bookingOverlap.number} for the currently assigned vehicle. Change the dates/times first.`, 409);

        const [rentalOverlap] = await tx.select({ id: rentalSegments.id, number: bookings.bookingNumber }).from(rentalSegments)
          .innerJoin(bookings, eq(rentalSegments.bookingId, bookings.id))
          .where(and(
            eq(rentalSegments.vehicleId, actualVehicleId),
            eq(rentalSegments.status, "active"),
            ne(rentalSegments.bookingId, bookingId),
            lt(rentalSegments.startAt, endAt),
          )).limit(1);
        if (rentalOverlap) throw new RequestError(`The corrected schedule overlaps active rental ${rentalOverlap.number}.`, 409);

        const rentalDays = Math.max(1, Math.ceil((endAt.getTime() - startAt.getTime()) / 86_400_000));
        const replacementFlow = segments.length > 1 || (segments.length === 1 && segments[0]?.vehicleId !== booking.requestedVehicleId);
        let baseRentalAmount: number;
        let expectedReturnKilometer = booking.expectedReturnKilometer;

        if (!replacementFlow) {
          const grossRentalAmount = roundMoney(rentalDays * booking.dailyRate);
          if (booking.bookingDiscount > grossRentalAmount) throw new RequestError("The existing rental discount is greater than the recalculated rent. Reduce the discount before shortening this rental.", 409);
          baseRentalAmount = roundMoney(grossRentalAmount - booking.bookingDiscount);
          if (booking.startingKilometer !== null) expectedReturnKilometer = calculateExpectedReturnKilometer(booking.startingKilometer, rentalDays, vehicle.allowedKmPerDay);
        } else {
          if (!activeSegment) throw new RequestError("The current vehicle segment could not be found. Sync and try again.", 409);
          const completedGross = segments.filter((segment) => segment.status !== "active").reduce((sum, segment) => sum + segment.rentalCharge, 0);
          const activeProjection = calculateSegmentCharge({
            startAt: activeSegment.startAt,
            endAt,
            dailyRate: activeSegment.dailyRate,
            startingKilometer: activeSegment.startingKilometer,
            endingKilometer: activeSegment.startingKilometer,
            allowedKmPerDay: activeSegment.allowedKmPerDay,
            extraKmRate: activeSegment.extraKmRate,
          });
          const grossRentalAmount = roundMoney(completedGross + activeProjection.rentalCharge);
          if (booking.bookingDiscount > grossRentalAmount) throw new RequestError("The existing rental discount is greater than the recalculated segmented rent. Reduce the discount before shortening this rental.", 409);
          baseRentalAmount = roundMoney(grossRentalAmount - booking.bookingDiscount);
          expectedReturnKilometer = calculateExpectedReturnKilometer(activeSegment.startingKilometer, activeProjection.rentalDays, activeSegment.allowedKmPerDay);
        }

        const [paidRow] = await tx.select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)::float8` }).from(payments).where(eq(payments.bookingId, bookingId));
        const paid = Number(paidRow?.total ?? 0);
        const completedExtraKm = segments.filter((segment) => segment.status !== "active").reduce((sum, segment) => sum + segment.extraKmCharge, 0);
        const graceDeadline = endAt.getTime() + 3 * 60 * 60 * 1000;
        const lateMs = Math.max(0, Date.now() - graceDeadline);
        const liveLateDays = !replacementFlow && lateMs > 0 ? Math.ceil(lateMs / 86_400_000) : 0;
        const currentPayable = roundMoney(baseRentalAmount + booking.otherCharges + completedExtraKm + liveLateDays * booking.dailyRate);
        if (paid > currentPayable + 0.001) throw new RequestError(`The rental already has ₹${paid.toLocaleString("en-IN")} recorded as paid. This schedule would reduce the current bill below that amount, so the edit was blocked.`, 409);

        await tx.update(bookings).set({ startAt, endAt, rentalDays, baseRentalAmount, expectedReturnKilometer, updatedAt: new Date() }).where(eq(bookings.id, bookingId));

        // A one-vehicle active rental historically used booking.start_at as the handover start.
        // Keep that existing edit behavior aligned with the new segment table. Never rewrite
        // completed segment history once a vehicle change has occurred.
        if (segments.length === 1 && activeSegment) {
          await tx.update(rentalSegments).set({ startAt, updatedAt: new Date() }).where(eq(rentalSegments.id, activeSegment.id));
        }

        return { bookingId, bookingNumber: booking.bookingNumber, rentalDays, baseRentalAmount, startAt: startAt.toISOString(), endAt: endAt.toISOString() };
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
