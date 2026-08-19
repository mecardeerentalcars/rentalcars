import { and, desc, eq, gt, lt, ne } from "drizzle-orm";
import { DatabaseConfigurationError, withRequestDb } from "@/db";
import { bookings, rentalSegments, vehicles } from "@/db/schema";
import { calculateSegmentCharge } from "@/lib/rental-segments";

class RequestError extends Error { constructor(message: string, readonly status = 400) { super(message); } }
const text = (value: unknown, field: string) => { if (typeof value !== "string" || !value.trim()) throw new RequestError(`${field} is required.`); return value.trim(); };
const dateTime = (value: unknown, field: string) => { const d = new Date(text(value, field)); if (Number.isNaN(d.getTime())) throw new RequestError(`${field} is invalid.`); return d; };
const whole = (value: unknown, field: string) => { const n = Number(value); if (!Number.isInteger(n) || n < 0) throw new RequestError(`${field} must be a whole number of zero or greater.`); return n; };

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const bookingNumber = text(body.bookingNumber, "Booking number");
    const changeAt = dateTime(body.changeAt, "Change date/time");
    const endingKilometer = whole(body.endingKilometer, "Ending kilometer");
    const nextVehicleId = text(body.nextVehicleId, "Replacement vehicle");
    const nextStartingKilometer = whole(body.nextStartingKilometer, "New vehicle starting kilometer");
    const nextStartingFuelRangeKm = whole(body.nextStartingFuelRangeKm ?? 0, "New vehicle starting fuel range");

    const result = await withRequestDb((db) => db.transaction(async (tx) => {
      const [booking] = await tx.select().from(bookings).where(eq(bookings.bookingNumber, bookingNumber)).limit(1).for("update");
      if (!booking) throw new RequestError("Rental was not found.", 404);
      if (booking.status !== "rented") throw new RequestError("Only an active rental can change vehicle.", 409);

      const [current] = await tx
        .select({ segment: rentalSegments, vehicle: vehicles })
        .from(rentalSegments)
        .innerJoin(vehicles, eq(rentalSegments.vehicleId, vehicles.id))
        .where(and(eq(rentalSegments.bookingId, booking.id), eq(rentalSegments.status, "active")))
        .orderBy(desc(rentalSegments.sequence))
        .limit(1)
        .for("update");
      if (!current) throw new RequestError("Active vehicle segment was not found. Sync the database and try again.", 409);
      if (changeAt.getTime() <= current.segment.startAt.getTime()) throw new RequestError("Vehicle change time must be after the current vehicle start time.");
      if (endingKilometer < current.segment.startingKilometer) throw new RequestError("Ending kilometer cannot be below the current segment starting kilometer.");
      if (nextVehicleId === current.segment.vehicleId) throw new RequestError("Select a different vehicle.");

      const [nextVehicle] = await tx.select().from(vehicles).where(eq(vehicles.id, nextVehicleId)).limit(1).for("update");
      if (!nextVehicle) throw new RequestError("Replacement vehicle was not found.", 404);
      if (["inactive", "maintenance"].includes(nextVehicle.status)) throw new RequestError("Selected vehicle is not available for rental.", 409);

      // The next segment only requires the vehicle to be free at changeAt.
      // A later booking remains untouched; staff can change vehicle again before it.
      const assignmentEnd = new Date(changeAt.getTime() + 1);
      const [bookedConflict] = await tx.select({ id: bookings.id, number: bookings.bookingNumber }).from(bookings).where(and(
        eq(bookings.vehicleId, nextVehicle.id),
        ne(bookings.id, booking.id),
        eq(bookings.status, "booked"),
        lt(bookings.startAt, assignmentEnd),
        gt(bookings.endAt, changeAt),
      )).limit(1);
      if (bookedConflict) throw new RequestError(`Selected vehicle has booking ${bookedConflict.number} at this change time.`, 409);

      const [activeConflict] = await tx.select({ id: rentalSegments.id, number: bookings.bookingNumber }).from(rentalSegments)
        .innerJoin(bookings, eq(rentalSegments.bookingId, bookings.id))
        .where(and(
          eq(rentalSegments.vehicleId, nextVehicle.id),
          eq(rentalSegments.status, "active"),
          ne(rentalSegments.bookingId, booking.id),
          // Active segment remains occupied until it is explicitly closed.
          lt(rentalSegments.startAt, assignmentEnd),
        )).limit(1);
      if (activeConflict) throw new RequestError(`Selected vehicle is already assigned to rental ${activeConflict.number}.`, 409);

      const charge = calculateSegmentCharge({
        startAt: current.segment.startAt,
        endAt: changeAt,
        dailyRate: current.segment.dailyRate,
        startingKilometer: current.segment.startingKilometer,
        endingKilometer,
        allowedKmPerDay: current.segment.allowedKmPerDay,
        extraKmRate: current.segment.extraKmRate,
      });

      await tx.update(rentalSegments).set({
        endAt: changeAt,
        endingKilometer,
        rentalDays: charge.rentalDays,
        rentalCharge: charge.rentalCharge,
        extraKilometers: charge.extraKilometers,
        extraKmCharge: charge.extraKmCharge,
        status: "completed",
        updatedAt: new Date(),
      }).where(eq(rentalSegments.id, current.segment.id));

      await tx.update(vehicles).set({ status: "available", odometerKm: endingKilometer, updatedAt: new Date() }).where(eq(vehicles.id, current.vehicle.id));

      await tx.insert(rentalSegments).values({
        bookingId: booking.id,
        sequence: current.segment.sequence + 1,
        vehicleId: nextVehicle.id,
        startAt: changeAt,
        startingKilometer: nextStartingKilometer,
        startingFuelRangeKm: nextStartingFuelRangeKm,
        dailyRate: nextVehicle.dailyRate,
        rentalDays: 1,
        rentalCharge: 0,
        allowedKmPerDay: nextVehicle.allowedKmPerDay,
        extraKmRate: nextVehicle.extraKmRate,
        status: "active",
      });

      await tx.update(vehicles).set({ status: "rented", odometerKm: nextStartingKilometer, updatedAt: new Date() }).where(eq(vehicles.id, nextVehicle.id));

      return {
        bookingNumber,
        finishedVehicle: current.vehicle.name,
        finishedCharge: charge.rentalCharge,
        nextVehicle: nextVehicle.name,
        nextVehicleGuest: nextVehicle.isGuest,
      };
    }));

    return Response.json({ ok: true, change: result }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestError) return Response.json({ ok: false, error: error.message }, { status: error.status });
    if (error instanceof DatabaseConfigurationError) return Response.json({ ok: false, error: error.message }, { status: 503 });
    console.error("Could not change rental vehicle", error);
    return Response.json({ ok: false, error: "Could not change the rental vehicle." }, { status: 500 });
  }
}
