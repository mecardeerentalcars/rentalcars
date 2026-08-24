// MECARDEE_RENTAL_EXPENSES_PAYMENTS_HUB_V8_9_81
// MECARDEE_ROLE_GUARD_V8_9_55
import { requireReadAccess, requireWriteAccess, requireSuperAdminAccess } from "@/lib/mecardee-auth";
// MECARDEE_BOOKED_VEHICLE_START_GUARD_V8_9_46
// MECARDEE_SOFT_BOOKING_CONFLICTS_V8_9_42
import { and, eq, gt, lt, ne } from "drizzle-orm";
import { DatabaseConfigurationError, withRequestDb } from "@/db";
import { bookings, customers, payments, rentalSegments, vehicles } from "@/db/schema";
import { calculateExpectedReturnKilometer, rentalDaysFromSchedule } from "@/lib/rental-calculations";

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
const optionalText = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
const date = (value: unknown, field: string) => {
  const result = new Date(text(value, field));
  if (Number.isNaN(result.getTime())) throw new RequestError(`${field} is invalid.`);
  return result;
};
const numberId = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const __mecardeeAuth = await requireWriteAccess();
  if (!__mecardeeAuth.ok) return __mecardeeAuth.response;
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
        const dailyRate = amount(body.dailyRate, "Daily rate");
        if (endAt <= startAt) throw new RequestError("Return date must be after the start date.");
        const rentalDays = rentalDaysFromSchedule(startAt, endAt);

        const requestedVehicleId = optionalText(body.vehicleId) ?? record.vehicle.id;
        const targetVehicle = requestedVehicleId === record.vehicle.id
          ? record.vehicle
          : (await tx.select().from(vehicles).where(eq(vehicles.id, requestedVehicleId)).limit(1).for("update"))[0];
        if (!targetVehicle) throw new RequestError("Selected vehicle was not found.", 404);

        const [bookingConflict] = await tx.select({ id: bookings.id }).from(bookings).where(and(
          eq(bookings.vehicleId, targetVehicle.id),
          ne(bookings.id, id),
          eq(bookings.status, "booked"),
          lt(bookings.startAt, endAt),
          gt(bookings.endAt, startAt),
        )).limit(1);
        const [rentalConflict] = await tx.select({ id: rentalSegments.id }).from(rentalSegments)
          .innerJoin(bookings, eq(rentalSegments.bookingId, bookings.id))
          .where(and(
            eq(rentalSegments.vehicleId, targetVehicle.id),
            eq(rentalSegments.status, "active"),
            ne(rentalSegments.bookingId, id),
            lt(rentalSegments.startAt, endAt),
          )).limit(1);
        const scheduleConflict = Boolean(bookingConflict || rentalConflict);

        await tx.update(bookings).set({
          vehicleId: targetVehicle.id,
          startAt,
          endAt,
          rentalDays,
          dailyRate,
          baseRentalAmount: Math.round(rentalDays * dailyRate * 100) / 100,
          updatedAt: new Date(),
        }).where(eq(bookings.id, id));
        return {
          action: "edited",
          bookingNumber: record.booking.bookingNumber,
          vehicleId: targetVehicle.id,
          requestedVehicleId: record.booking.requestedVehicleId,
          scheduleConflict,
        };
      }

      if (action !== "start") throw new RequestError("Booking action is invalid.");

      const replacementVehicleId = optionalText(body.replacementVehicleId);
      let assignedVehicle = record.vehicle;

      // MECARDEE_BOOKED_VEHICLE_START_GUARD_V8_9_46
      // Determine physical availability only at the pickup instant. A later
      // schedule overlap is a soft warning and must NEVER cause a different
      // vehicle to be silently started.
      const originalPickupEnd = new Date(record.booking.startAt.getTime() + 1);
      const [originalBookedPickupConflict] = await tx.select({ id: bookings.id }).from(bookings).where(and(
        eq(bookings.vehicleId, record.vehicle.id),
        ne(bookings.id, record.booking.id),
        eq(bookings.status, "booked"),
        lt(bookings.startAt, originalPickupEnd),
        gt(bookings.endAt, record.booking.startAt),
      )).limit(1);
      const [originalActivePickupConflict] = await tx.select({ id: rentalSegments.id }).from(rentalSegments)
        .innerJoin(bookings, eq(rentalSegments.bookingId, bookings.id))
        .where(and(
          eq(rentalSegments.vehicleId, record.vehicle.id),
          eq(rentalSegments.status, "active"),
          ne(rentalSegments.bookingId, record.booking.id),
          lt(rentalSegments.startAt, originalPickupEnd),
        )).limit(1);
      const originalUnavailableAtPickup =
        ["inactive", "maintenance"].includes(record.vehicle.status) ||
        Boolean(originalBookedPickupConflict) ||
        Boolean(originalActivePickupConflict);

      if (replacementVehicleId && replacementVehicleId !== record.vehicle.id && !originalUnavailableAtPickup) {
        throw new RequestError(`Booked vehicle ${record.vehicle.name} (${record.vehicle.registrationNumber}) is available at pickup. Start the rental with the booked vehicle; do not use a replacement.`, 409);
      }

      if (replacementVehicleId) {
        const [replacement] = await tx.select().from(vehicles).where(eq(vehicles.id, replacementVehicleId)).limit(1).for("update");
        if (!replacement) throw new RequestError("Replacement vehicle was not found.", 404);
        if (["inactive", "maintenance"].includes(replacement.status)) throw new RequestError("Replacement vehicle is not available for rental.", 409);
        const assignmentEnd = new Date(record.booking.startAt.getTime() + 1);
        const [bookedConflict] = await tx.select({ id: bookings.id }).from(bookings).where(and(
          eq(bookings.vehicleId, replacement.id),
          ne(bookings.id, record.booking.id),
          eq(bookings.status, "booked"),
          lt(bookings.startAt, assignmentEnd),
          gt(bookings.endAt, record.booking.startAt),
        )).limit(1);
        if (bookedConflict) throw new RequestError("Replacement vehicle already has a booking at this pickup time.", 409);
        const [activeConflict] = await tx.select({ id: rentalSegments.id }).from(rentalSegments).innerJoin(bookings, eq(rentalSegments.bookingId, bookings.id)).where(and(
          eq(rentalSegments.vehicleId, replacement.id),
          eq(rentalSegments.status, "active"),
          ne(rentalSegments.bookingId, record.booking.id),
          lt(rentalSegments.startAt, assignmentEnd),
        )).limit(1);
        if (activeConflict) throw new RequestError("Replacement vehicle is currently assigned to another rental.", 409);
        assignedVehicle = replacement;
      } else {
        // Soft scheduling conflicts are allowed at booking time. Handover is a hard
        // availability check only at the pickup instant. A later booking stays
        // protected and staff can Change Vehicle before that future collision.
        const pickupEnd = new Date(record.booking.startAt.getTime() + 1);
        const [bookedPickupConflict] = await tx.select({ id: bookings.id }).from(bookings).where(and(
          eq(bookings.vehicleId, record.vehicle.id),
          ne(bookings.id, record.booking.id),
          eq(bookings.status, "booked"),
          lt(bookings.startAt, pickupEnd),
          gt(bookings.endAt, record.booking.startAt),
        )).limit(1);
        const [activeConflict] = await tx.select({ id: rentalSegments.id }).from(rentalSegments)
          .innerJoin(bookings, eq(rentalSegments.bookingId, bookings.id))
          .where(and(
            eq(rentalSegments.vehicleId, record.vehicle.id),
            eq(rentalSegments.status, "active"),
            ne(rentalSegments.bookingId, record.booking.id),
            lt(rentalSegments.startAt, pickupEnd),
          ))
          .limit(1);
        if (["inactive", "maintenance", "rented"].includes(record.vehicle.status) || bookedPickupConflict || activeConflict) {
          throw new RequestError("Booked vehicle is not physically available at pickup. Select an available replacement vehicle or Guest Car to start this booking.", 409);
        }
      }

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
      const expectedReturnKilometer = calculateExpectedReturnKilometer(startingKilometer, record.booking.rentalDays, assignedVehicle.allowedKmPerDay);

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

      await tx.insert(rentalSegments).values({
        bookingId: record.booking.id,
        sequence: 1,
        vehicleId: assignedVehicle.id,
        startAt: record.booking.startAt,
        startingKilometer,
        startingFuelRangeKm,
        dailyRate: assignedVehicle.id === record.vehicle.id ? dailyRate : assignedVehicle.dailyRate,
        rentalDays: 1,
        rentalCharge: 0,
        allowedKmPerDay: assignedVehicle.allowedKmPerDay,
        extraKmRate: assignedVehicle.extraKmRate,
        status: "active",
      });

      if (advancePaid > 0) {
        await tx.insert(payments).values({
          paymentNumber: numberId("PAY"),
          bookingId: record.booking.id,
          customerId: record.customer.id,
          amount: advancePaid,
          method: text(body.paymentMethod ?? "UPI", "Payment method"),
          paymentType: "advance",
          notes: `Advance for ${record.booking.bookingNumber}`,
          receivedBy: __mecardeeAuth.user.username,
          receivedAt: new Date(),
        });
      }
      await tx.update(vehicles).set({ status: "rented", odometerKm: startingKilometer, updatedAt: new Date() }).where(eq(vehicles.id, assignedVehicle.id));
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
