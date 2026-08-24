// MECARDEE_RENTAL_EXPENSES_PAYMENTS_HUB_V8_9_81
// MECARDEE_ROLE_GUARD_V8_9_55
import { requireReadAccess, requireWriteAccess, requireSuperAdminAccess } from "@/lib/mecardee-auth";
import { and, eq, gt, lt, ne } from "drizzle-orm";
import { DatabaseConfigurationError, withRequestDb } from "@/db";
import { bookings, customers, payments, rentalSegments, vehicles } from "@/db/schema";
import { nextSimpleBookingNumber } from "@/lib/simple-booking-number";
import { calculateExpectedReturnKilometer, rentalDaysFromSchedule } from "@/lib/rental-calculations";

type CreateRentalBody = {
  vehicleRegistration?: unknown;
  replacementVehicleId?: unknown;
  customerPhone?: unknown;
  startAt?: unknown;
  endAt?: unknown;
  rentalDays?: unknown;
  dailyRate?: unknown;
  securityDeposit?: unknown;
  advancePaid?: unknown;
  bookingDiscount?: unknown;
  startingKilometer?: unknown;
  startingFuelRangeKm?: unknown;
  paymentMethod?: unknown;
  receivedBy?: unknown;
  mode?: unknown;
};

class RequestError extends Error {
  constructor(message: string, readonly status = 400, readonly details?: Record<string, unknown>) { super(message); }
}
const text = (value: unknown, field: string) => { if (typeof value !== "string" || !value.trim()) throw new RequestError(`${field} is required.`); return value.trim(); };
const optionalText = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
const amount = (value: unknown, field: string) => { const number = Number(value); if (!Number.isFinite(number) || number < 0) throw new RequestError(`${field} must be zero or greater.`); return Math.round(number * 100) / 100; };
const wholeNumber = (value: unknown, field: string, minimum = 0) => { const number = Number(value); if (!Number.isInteger(number) || number < minimum) throw new RequestError(`${field} must be a whole number of at least ${minimum}.`); return number; };
const date = (value: unknown, field: string) => { const result = new Date(text(value, field)); if (Number.isNaN(result.getTime())) throw new RequestError(`${field} is invalid.`); return result; };
const numberId = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

async function vehicleConflict(tx: any, vehicleId: string, startAt: Date, endAt: Date, excludeBookingId?: string) {
  const bookedWhere = excludeBookingId
    ? and(eq(bookings.vehicleId, vehicleId), eq(bookings.status, "booked"), ne(bookings.id, excludeBookingId), lt(bookings.startAt, endAt), gt(bookings.endAt, startAt))
    : and(eq(bookings.vehicleId, vehicleId), eq(bookings.status, "booked"), lt(bookings.startAt, endAt), gt(bookings.endAt, startAt));
  const [futureBooking] = await tx.select({ id: bookings.id, number: bookings.bookingNumber }).from(bookings).where(bookedWhere).limit(1);
  if (futureBooking) return { type: "booking", number: futureBooking.number };

  const [activeSegment] = await tx
    .select({ id: rentalSegments.id, bookingId: rentalSegments.bookingId, number: bookings.bookingNumber })
    .from(rentalSegments)
    .innerJoin(bookings, eq(rentalSegments.bookingId, bookings.id))
    .where(and(
      eq(rentalSegments.vehicleId, vehicleId),
      eq(rentalSegments.status, "active"),
      excludeBookingId ? ne(rentalSegments.bookingId, excludeBookingId) : undefined,
      // An active segment has no known end until Change Vehicle/Settlement.
      // Treat it as occupied from its start onward even if the planned booking end passed.
      lt(rentalSegments.startAt, endAt),
    ))
    .limit(1);
  return activeSegment ? { type: "rental", number: activeSegment.number } : null;
}

export async function POST(request: Request) {
  const __mecardeeAuth = await requireWriteAccess();
  if (!__mecardeeAuth.ok) return __mecardeeAuth.response;
  try {
    const body = (await request.json()) as CreateRentalBody;
    const vehicleRegistration = text(body.vehicleRegistration, "Vehicle registration");
    const replacementVehicleId = optionalText(body.replacementVehicleId);
    const customerPhone = text(body.customerPhone, "Customer phone");
    const startAt = date(body.startAt, "Start date");
    const endAt = date(body.endAt, "Return date");
    const dailyRate = amount(body.dailyRate, "Daily rate");
    const securityDeposit = amount(body.securityDeposit ?? 0, "Security deposit");
    const advancePaid = amount(body.advancePaid ?? 0, "Advance paid");
    const bookingDiscount = amount(body.bookingDiscount ?? 0, "Discount");
    const startingKilometer = wholeNumber(body.startingKilometer, "Starting kilometer");
    const startingFuelRangeKm = wholeNumber(body.startingFuelRangeKm, "Starting fuel range");
    const paymentMethod = advancePaid > 0 ? text(body.paymentMethod, "Payment method") : "Not recorded";
    const receivedBy = __mecardeeAuth.user.username;
    const mode = body.mode === "draft" ? "draft" : "rented";

    if (endAt <= startAt) throw new RequestError("Return date must be after the start date.");
    const rentalDays = rentalDaysFromSchedule(startAt, endAt);
    const grossRentalAmount = Math.round(rentalDays * dailyRate * 100) / 100;
    if (bookingDiscount > grossRentalAmount) throw new RequestError("Discount cannot exceed the rental amount.");
    const baseRentalAmount = grossRentalAmount - bookingDiscount;
    if (advancePaid > baseRentalAmount) throw new RequestError("Advance paid cannot exceed the rental total.");

    const created = await withRequestDb((db) => db.transaction(async (tx) => {
      const [requestedVehicle] = await tx.select().from(vehicles).where(eq(vehicles.registrationNumber, vehicleRegistration)).limit(1).for("update");
      if (!requestedVehicle) throw new RequestError("Vehicle was not found.", 404);
      if (requestedVehicle.isGuest) throw new RequestError("Select one of your own vehicles as the original requested vehicle.", 409);

      const requestedConflict = mode === "draft" ? null : await vehicleConflict(tx, requestedVehicle.id, startAt, endAt);
      if (mode !== "draft" && requestedConflict && !replacementVehicleId) {
        throw new RequestError("Original vehicle is unavailable for part of this rental. Select an available replacement vehicle or a Guest Car to continue.", 409, { conflict: true, requestedVehicleId: requestedVehicle.id });
      }

      let assignedVehicle = requestedVehicle;
      if (mode !== "draft" && replacementVehicleId) {
        const [replacement] = await tx.select().from(vehicles).where(eq(vehicles.id, replacementVehicleId)).limit(1).for("update");
        if (!replacement) throw new RequestError("Replacement vehicle was not found.", 404);
        if (["inactive", "maintenance"].includes(replacement.status)) throw new RequestError("Replacement vehicle is not available for rental.", 409);
        // Replacement only has to be free at handover. A later future booking is
        // preserved and the rental can Change Vehicle again before that booking.
        const assignmentEnd = new Date(startAt.getTime() + 1);
        const replacementConflict = await vehicleConflict(tx, replacement.id, startAt, assignmentEnd);
        if (replacementConflict) throw new RequestError(`Replacement vehicle is already committed to ${replacementConflict.number} at the rental start time.`, 409);
        assignedVehicle = replacement;
      } else if (mode !== "draft") {
        if (requestedVehicle.status !== "available") throw new RequestError("Vehicle is not currently available.", 409);
        if (requestedConflict) throw new RequestError("Vehicle is already booked for the selected dates.", 409);
      }

      const [customer] = await tx.select().from(customers).where(eq(customers.phone, customerPhone)).limit(1);
      if (!customer) throw new RequestError("Customer was not found.", 404);

      const expectedReturnKilometer = calculateExpectedReturnKilometer(startingKilometer, rentalDays, assignedVehicle.allowedKmPerDay);
      const bookingNumber = await nextSimpleBookingNumber(tx, mode === "draft" ? "DRF" : "RNT");
      const [booking] = await tx.insert(bookings).values({
        bookingNumber,
        requestedVehicleId: requestedVehicle.id,
        vehicleId: requestedVehicle.id,
        customerId: customer.id,
        startAt,
        endAt,
        rentalDays,
        dailyRate,
        baseRentalAmount,
        bookingDiscount,
        advancePaid,
        securityDeposit,
        startingKilometer,
        startingFuelRangeKm,
        expectedReturnKilometer,
        status: mode,
        handedOverAt: mode === "draft" ? null : new Date(),
      }).returning();

      if (mode !== "draft") {
        await tx.insert(rentalSegments).values({
          bookingId: booking.id,
          sequence: 1,
          vehicleId: assignedVehicle.id,
          startAt,
          startingKilometer,
        startingFuelRangeKm,
          dailyRate: assignedVehicle.id === requestedVehicle.id ? dailyRate : assignedVehicle.dailyRate,
          rentalDays: 1,
          rentalCharge: 0,
          allowedKmPerDay: assignedVehicle.allowedKmPerDay,
          extraKmRate: assignedVehicle.extraKmRate,
          status: "active",
        });
        if (advancePaid > 0) await tx.insert(payments).values({
          paymentNumber: numberId("PAY"), bookingId: booking.id, customerId: customer.id, amount: advancePaid,
          method: paymentMethod, paymentType: "advance", notes: `Advance for ${bookingNumber}`, receivedBy, receivedAt: new Date(),
        });
        await tx.update(vehicles).set({ status: "rented", odometerKm: startingKilometer, updatedAt: new Date() }).where(eq(vehicles.id, assignedVehicle.id));
      }

      return { bookingNumber, expectedReturnKilometer, allowedKmPerDay: assignedVehicle.allowedKmPerDay, mode, requestedVehicleId: requestedVehicle.id, assignedVehicleId: assignedVehicle.id, replacementUsed: assignedVehicle.id !== requestedVehicle.id };
    }));

    return Response.json({ ok: true, rental: created }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestError) return Response.json({ ok: false, error: error.message, ...(error.details ?? {}) }, { status: error.status });
    if (error instanceof DatabaseConfigurationError) return Response.json({ ok: false, error: error.message }, { status: 503 });
    console.error("Could not create rental", error);
    return Response.json({ ok: false, error: "Could not save the rental." }, { status: 500 });
  }
}
