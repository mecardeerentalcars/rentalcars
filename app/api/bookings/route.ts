// MECARDEE_ROLE_GUARD_V8_9_55
import { requireReadAccess, requireWriteAccess, requireSuperAdminAccess } from "@/lib/mecardee-auth";
// MECARDEE_SOFT_BOOKING_CONFLICTS_V8_9_42
import { and, eq, gt, lt } from "drizzle-orm";
import { DatabaseConfigurationError, withRequestDb } from "@/db";
import { bookings, customers, rentalSegments, vehicles } from "@/db/schema";
import { nextSimpleBookingNumber } from "@/lib/simple-booking-number";
import { rentalDaysFromSchedule } from "@/lib/rental-calculations";

type CreateBookingBody = {
  requestedVehicleRegistration?: unknown;
  vehicleRegistration?: unknown;
  customerPhone?: unknown;
  startAt?: unknown;
  endAt?: unknown;
  rentalDays?: unknown;
  dailyRate?: unknown;
};

class RequestError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
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
const amount = (value: unknown, field: string) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new RequestError(`${field} must be zero or greater.`);
  return Math.round(number * 100) / 100;
};
export async function POST(request: Request) {
  const __mecardeeAuth = await requireWriteAccess();
  if (!__mecardeeAuth.ok) return __mecardeeAuth.response;
  try {
    const body = await request.json() as CreateBookingBody;
    const vehicleRegistration = text(body.vehicleRegistration, "Vehicle registration");
    const requestedVehicleRegistration = optionalText(body.requestedVehicleRegistration) ?? vehicleRegistration;
    const customerPhone = text(body.customerPhone, "Customer phone");
    const startAt = date(body.startAt, "Start date");
    const endAt = date(body.endAt, "Return date");
    const dailyRate = amount(body.dailyRate, "Daily rate");
    if (endAt <= startAt) throw new RequestError("Return date must be after the start date.");
    const rentalDays = rentalDaysFromSchedule(startAt, endAt);

    const result = await withRequestDb((db) => db.transaction(async (tx) => {
      const [requestedVehicle] = await tx.select().from(vehicles).where(eq(vehicles.registrationNumber, requestedVehicleRegistration)).limit(1).for("update");
      if (!requestedVehicle) throw new RequestError("Original requested vehicle was not found.", 404);
      if (requestedVehicle.isGuest) throw new RequestError("Select one of your own vehicles as the original requested vehicle.", 409);

      const assignedVehicle = requestedVehicle.registrationNumber === vehicleRegistration
        ? requestedVehicle
        : (await tx.select().from(vehicles).where(eq(vehicles.registrationNumber, vehicleRegistration)).limit(1).for("update"))[0];
      if (!assignedVehicle) throw new RequestError("Selected booking vehicle was not found.", 404);

      // The booking reserves the vehicle actually selected for this period.
      // requestedVehicleId preserves the customer's original vehicle request when
      // a different own vehicle or Guest Car is used because of a conflict.
      const [bookingConflict] = await tx.select({ id: bookings.id }).from(bookings).where(and(
        eq(bookings.vehicleId, assignedVehicle.id),
        eq(bookings.status, "booked"),
        lt(bookings.startAt, endAt),
        gt(bookings.endAt, startAt),
      )).limit(1);
      const [rentalConflict] = await tx.select({ id: rentalSegments.id }).from(rentalSegments)
        .innerJoin(bookings, eq(rentalSegments.bookingId, bookings.id))
        .where(and(
          eq(rentalSegments.vehicleId, assignedVehicle.id),
          eq(rentalSegments.status, "active"),
          lt(rentalSegments.startAt, endAt),
        )).limit(1);
      const scheduleConflict = Boolean(bookingConflict || rentalConflict);
      if (assignedVehicle.id !== requestedVehicle.id && scheduleConflict) {
        throw new RequestError("Selected replacement vehicle is already booked or on rent for the selected period.", 409);
      }

      const [customer] = await tx.select().from(customers).where(eq(customers.phone, customerPhone)).limit(1);
      if (!customer) throw new RequestError("Customer was not found.", 404);

      const bookingNumber = await nextSimpleBookingNumber(tx, "BKG");
      const [booking] = await tx.insert(bookings).values({
        bookingNumber,
        requestedVehicleId: requestedVehicle.id,
        vehicleId: assignedVehicle.id,
        customerId: customer.id,
        startAt,
        endAt,
        rentalDays,
        dailyRate,
        baseRentalAmount: Math.round(rentalDays * dailyRate * 100) / 100,
        bookingDiscount: 0,
        otherCharges: 0,
        advancePaid: 0,
        securityDeposit: 0,
        startingKilometer: null,
        startingFuelRangeKm: null,
        expectedReturnKilometer: null,
        status: "booked",
        handedOverAt: null,
      }).returning();

      return {
        id: booking.id,
        bookingNumber,
        requestedVehicleId: requestedVehicle.id,
        vehicleId: assignedVehicle.id,
        replacementBooked: requestedVehicle.id !== assignedVehicle.id,
        scheduleConflict,
      };
    }));

    return Response.json({ ok: true, booking: result }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestError) return Response.json({ ok: false, error: error.message }, { status: error.status });
    if (error instanceof DatabaseConfigurationError) return Response.json({ ok: false, error: error.message }, { status: 503 });
    console.error("Could not create booking", error);
    return Response.json({ ok: false, error: "Could not save the booking." }, { status: 500 });
  }
}
