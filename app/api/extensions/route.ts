// MECARDEE_ROLE_GUARD_V8_9_55
import { requireReadAccess, requireWriteAccess, requireSuperAdminAccess } from "@/lib/mecardee-auth";
import { and, desc, eq, gt, lt, ne } from "drizzle-orm";
import { DatabaseConfigurationError, withRequestDb } from "@/db";
import { bookings, rentalExtensions, rentalSegments, vehicles } from "@/db/schema";
import { calculateExpectedReturnKilometer } from "@/lib/rental-calculations";

type ExtensionBody = { bookingNumber?: unknown; additionalDays?: unknown; notes?: unknown };
class RequestError extends Error { constructor(message: string, readonly status = 400) { super(message); } }
const text = (value: unknown, field: string) => { if (typeof value !== "string" || !value.trim()) throw new RequestError(`${field} is required.`); return value.trim(); };
const wholeNumber = (value: unknown, field: string) => { const number = Number(value); if (!Number.isInteger(number) || number < 1 || number > 365) throw new RequestError(`${field} must be between 1 and 365.`); return number; };
const optionalText = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

export async function POST(request: Request) {
  const __mecardeeAuth = await requireWriteAccess();
  if (!__mecardeeAuth.ok) return __mecardeeAuth.response;
  try {
    const body = (await request.json()) as ExtensionBody;
    const bookingNumber = text(body.bookingNumber, "Booking number");
    const additionalDays = wholeNumber(body.additionalDays, "Additional days");
    const notes = optionalText(body.notes);

    const result = await withRequestDb((db) => db.transaction(async (tx) => {
      const [record] = await tx.select({ booking: bookings, originalVehicle: vehicles }).from(bookings)
        .innerJoin(vehicles, eq(bookings.vehicleId, vehicles.id))
        .where(eq(bookings.bookingNumber, bookingNumber)).limit(1).for("update");
      if (!record) throw new RequestError("Rental booking was not found.", 404);
      if (!["booked", "rented"].includes(record.booking.status)) throw new RequestError("Only active rentals can be extended.", 409);

      let actualVehicle = record.originalVehicle;
      let segment: typeof rentalSegments.$inferSelect | null = null;
      if (record.booking.status === "rented") {
        const [active] = await tx.select({ segment: rentalSegments, vehicle: vehicles }).from(rentalSegments)
          .innerJoin(vehicles, eq(rentalSegments.vehicleId, vehicles.id))
          .where(and(eq(rentalSegments.bookingId, record.booking.id), eq(rentalSegments.status, "active")))
          .orderBy(desc(rentalSegments.sequence)).limit(1);
        if (active) { segment = active.segment; actualVehicle = active.vehicle; }
      }

      const previousEndAt = record.booking.endAt;
      const newEndAt = new Date(previousEndAt.getTime() + additionalDays * 86_400_000);
      const [futureBookingConflict] = await tx.select({ id: bookings.id }).from(bookings).where(and(
        eq(bookings.vehicleId, actualVehicle.id), ne(bookings.id, record.booking.id), eq(bookings.status, "booked"),
        lt(bookings.startAt, newEndAt), gt(bookings.endAt, previousEndAt),
      )).limit(1);
      if (futureBookingConflict) throw new RequestError("This extension overlaps another booking for the currently assigned vehicle.", 409);

      const [activeConflict] = await tx.select({ id: rentalSegments.id }).from(rentalSegments)
        .innerJoin(bookings, eq(rentalSegments.bookingId, bookings.id))
        .where(and(eq(rentalSegments.vehicleId, actualVehicle.id), eq(rentalSegments.status, "active"), ne(rentalSegments.bookingId, record.booking.id), lt(rentalSegments.startAt, newEndAt))).limit(1);
      if (activeConflict) throw new RequestError("This extension overlaps another active rental for the currently assigned vehicle.", 409);

      const extensionRate = segment?.dailyRate ?? record.booking.dailyRate;
      const addedAmount = Math.round(extensionRate * additionalDays * 100) / 100;
      const rentalDays = record.booking.rentalDays + additionalDays;
      const expectedReturnKilometer = segment
        ? calculateExpectedReturnKilometer(segment.startingKilometer, Math.max(1, rentalDays), segment.allowedKmPerDay)
        : record.booking.startingKilometer === null
          ? record.booking.expectedReturnKilometer
          : calculateExpectedReturnKilometer(record.booking.startingKilometer, rentalDays, actualVehicle.allowedKmPerDay);

      await tx.insert(rentalExtensions).values({ bookingId: record.booking.id, previousEndAt, newEndAt, additionalDays, dailyRate: extensionRate, addedAmount, notes });
      await tx.update(bookings).set({
        endAt: newEndAt,
        rentalDays,
        baseRentalAmount: Math.round((record.booking.baseRentalAmount + addedAmount) * 100) / 100,
        expectedReturnKilometer,
        updatedAt: new Date(),
      }).where(eq(bookings.id, record.booking.id));

      return { bookingNumber, additionalDays, addedAmount, newEndAt: newEndAt.toISOString() };
    }));

    return Response.json({ ok: true, extension: result }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestError) return Response.json({ ok: false, error: error.message }, { status: error.status });
    if (error instanceof DatabaseConfigurationError) return Response.json({ ok: false, error: error.message }, { status: 503 });
    console.error("Could not extend rental", error);
    return Response.json({ ok: false, error: "Could not extend the rental." }, { status: 500 });
  }
}
