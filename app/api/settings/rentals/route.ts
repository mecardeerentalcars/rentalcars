// MECARDEE_ROLE_GUARD_V8_9_55
import { requireSuperAdminAccess } from "@/lib/mecardee-auth";
// MECARDEE_SETTINGS_SOFT_BOOKING_OVERLAP_V8_9_48
// MECARDEE_RENTAL_CORRECTION_UNDO_START_V8_9_47
import { and, eq, gt, lt, ne, sql } from "drizzle-orm";
import { DatabaseConfigurationError, withRequestDb, type AppDb } from "@/db";
import { bookings, customers, payments, rentalExtensions, rentalSegments, returnSettlements, vehicles } from "@/db/schema";
import { calculateExpectedReturnKilometer, rentalDaysFromSchedule } from "@/lib/rental-calculations";
import { calculateSegmentCharge } from "@/lib/rental-segments";

type AnyRow = Record<string, unknown>;
class RequestError extends Error { constructor(message: string, readonly status = 400) { super(message); } }

const text = (value: unknown, field: string) => {
  if (typeof value !== "string" || !value.trim()) throw new RequestError(`${field} is required.`);
  return value.trim();
};
const optionalText = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : "";
const dateTime = (value: unknown, field: string) => {
  const parsed = new Date(text(value, field));
  if (Number.isNaN(parsed.getTime())) throw new RequestError(`${field} is invalid.`);
  return parsed;
};
const whole = (value: unknown, field: string) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new RequestError(`${field} must be a whole number of zero or greater.`);
  return number;
};
const money = (value: unknown, field: string, allowZero = true) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || (!allowZero && number === 0)) {
    throw new RequestError(`${field} must be ${allowZero ? "zero or greater" : "greater than zero"}.`);
  }
  return Math.round((number + Number.EPSILON) * 100) / 100;
};
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

async function ensureRentalReopenHistoryTable(db: AppDb) {
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS rental_reopen_history (
      id uuid PRIMARY KEY,
      booking_id uuid NOT NULL,
      booking_number varchar(32) NOT NULL,
      reason text NOT NULL,
      snapshot jsonb NOT NULL,
      reopened_by varchar(120) NOT NULL DEFAULT 'Admin',
      reopened_at timestamptz NOT NULL DEFAULT now()
    )
  `));
  await db.execute(sql.raw(`
    CREATE INDEX IF NOT EXISTS rental_reopen_history_booking_idx
      ON rental_reopen_history (booking_id, reopened_at DESC)
  `));
}

export async function PATCH(request: Request) {
  const __mecardeeAuth = await requireSuperAdminAccess();
  if (!__mecardeeAuth.ok) return __mecardeeAuth.response;
  try {
    const body = await request.json() as AnyRow;
    const bookingId = text(body.bookingId, "Rental ID");
    const action = optionalText(body.action).toLowerCase();

    if (action === "correct-vehicle") {
      const targetVehicleId = text(body.vehicleId, "Correct vehicle");
      const startingKilometer = whole(body.startingKilometer, "Starting kilometer");
      const startingFuelRangeKm = whole(body.startingFuelRangeKm, "Starting fuel range");

      return await withRequestDb(async (db) => {
        const result = await db.transaction(async (tx) => {
          const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1).for("update");
          if (!booking) throw new RequestError("Rental was not found.", 404);
          if (booking.status !== "rented") throw new RequestError("Only an active/on-rent rental can have its vehicle corrected.", 409);

          const [settlement] = await tx.select({ id: returnSettlements.id }).from(returnSettlements).where(eq(returnSettlements.bookingId, bookingId)).limit(1);
          if (settlement) throw new RequestError("This rental already has a Final Settlement and cannot be corrected.", 409);

          const segments = await tx.select().from(rentalSegments).where(eq(rentalSegments.bookingId, bookingId)).orderBy(rentalSegments.sequence);
          if (segments.length !== 1 || segments[0]?.status !== "active") {
            throw new RequestError("Vehicle correction is only for a mistaken initial rental start. This rental already has vehicle history; use Change Vehicle instead.", 409);
          }

          const segment = segments[0];
          const [currentVehicle] = await tx.select().from(vehicles).where(eq(vehicles.id, segment.vehicleId)).limit(1);
          const [targetVehicle] = await tx.select().from(vehicles).where(eq(vehicles.id, targetVehicleId)).limit(1);
          if (!currentVehicle) throw new RequestError("The currently assigned vehicle could not be found.", 409);
          if (!targetVehicle) throw new RequestError("The selected correction vehicle could not be found.", 404);
          if (["inactive", "maintenance"].includes(targetVehicle.status)) throw new RequestError("The selected vehicle is inactive or under maintenance.", 409);

          if (targetVehicle.id !== currentVehicle.id) {
            const [activeConflict] = await tx.select({ id: rentalSegments.id, number: bookings.bookingNumber }).from(rentalSegments)
              .innerJoin(bookings, eq(rentalSegments.bookingId, bookings.id))
              .where(and(
                eq(rentalSegments.vehicleId, targetVehicle.id),
                eq(rentalSegments.status, "active"),
                ne(rentalSegments.bookingId, bookingId),
              )).limit(1);
            if (activeConflict) throw new RequestError(`${targetVehicle.name} is already on active rental ${activeConflict.number}.`, 409);

            const now = new Date();
            const nowPlus = new Date(now.getTime() + 1);
            const [bookingConflict] = await tx.select({ id: bookings.id, number: bookings.bookingNumber }).from(bookings).where(and(
              eq(bookings.vehicleId, targetVehicle.id),
              ne(bookings.id, bookingId),
              eq(bookings.status, "booked"),
              lt(bookings.startAt, nowPlus),
              gt(bookings.endAt, now),
            )).limit(1);
            if (bookingConflict) throw new RequestError(`${targetVehicle.name} is reserved right now by ${bookingConflict.number}.`, 409);
          }

          const segmentRate = targetVehicle.id === booking.vehicleId ? booking.dailyRate : targetVehicle.dailyRate;
          const expectedReturnKilometer = calculateExpectedReturnKilometer(startingKilometer, booking.rentalDays, targetVehicle.allowedKmPerDay);

          await tx.update(rentalSegments).set({
            vehicleId: targetVehicle.id,
            startingKilometer,
            startingFuelRangeKm,
            dailyRate: segmentRate,
            allowedKmPerDay: targetVehicle.allowedKmPerDay,
            extraKmRate: targetVehicle.extraKmRate,
            updatedAt: new Date(),
          }).where(eq(rentalSegments.id, segment.id));

          await tx.update(bookings).set({
            startingKilometer,
            startingFuelRangeKm,
            expectedReturnKilometer,
            updatedAt: new Date(),
          }).where(eq(bookings.id, bookingId));

          if (targetVehicle.id !== currentVehicle.id) {
            await tx.update(vehicles).set({ status: "available", updatedAt: new Date() }).where(eq(vehicles.id, currentVehicle.id));
            await tx.update(vehicles).set({ status: "rented", odometerKm: startingKilometer, updatedAt: new Date() }).where(eq(vehicles.id, targetVehicle.id));
          } else {
            await tx.update(vehicles).set({ status: "rented", odometerKm: startingKilometer, updatedAt: new Date() }).where(eq(vehicles.id, targetVehicle.id));
          }

          return {
            bookingNumber: booking.bookingNumber,
            vehicle: targetVehicle.name,
            plate: targetVehicle.registrationNumber,
          };
        });

        return Response.json({ ok: true, ...result });
      });
    }

    if (action === "edit-details") {
      const customerId = text(body.customerId, "Customer");
      const startAt = dateTime(body.startAt, "Rental start date/time");
      const endAt = dateTime(body.endAt, "Expected return date/time");
      const dailyRate = money(body.dailyRate, "Daily rate", false);
      const bookingDiscount = money(body.bookingDiscount ?? 0, "Booking discount");
      const otherCharges = money(body.otherCharges ?? 0, "Other charges");
      const securityDeposit = money(body.securityDeposit ?? 0, "Security deposit");
      const startingKilometer = whole(body.startingKilometer, "Current segment starting kilometer");
      const startingFuelRangeKm = whole(body.startingFuelRangeKm, "Current segment starting fuel range");
      const allowedKmPerDay = whole(body.allowedKmPerDay, "Allowed kilometers per day");
      const extraKmRate = money(body.extraKmRate, "Extra kilometer rate");
      if (endAt <= startAt) throw new RequestError("Expected return must be after the rental start date/time.");

      return await withRequestDb(async (db) => {
        const result = await db.transaction(async (tx) => {
          const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1).for("update");
          if (!booking) throw new RequestError("Rental was not found.", 404);
          if (booking.status !== "rented") throw new RequestError("Only an active/on-rent rental can be edited. Reopen a completed return first.", 409);

          const [settlement] = await tx.select({ id: returnSettlements.id }).from(returnSettlements).where(eq(returnSettlements.bookingId, bookingId)).limit(1);
          if (settlement) throw new RequestError("This rental still has a Final Settlement and cannot be edited.", 409);

          const [customer] = await tx.select({ id: customers.id, name: customers.name }).from(customers).where(eq(customers.id, customerId)).limit(1);
          if (!customer) throw new RequestError("The selected customer was not found.", 404);

          const segments = await tx.select().from(rentalSegments).where(eq(rentalSegments.bookingId, bookingId)).orderBy(rentalSegments.sequence);
          const activeSegment = [...segments].reverse().find((segment) => segment.status === "active") ?? null;
          if (!activeSegment) throw new RequestError("The current active vehicle segment could not be found.", 409);
          const [vehicle] = await tx.select().from(vehicles).where(eq(vehicles.id, activeSegment.vehicleId)).limit(1).for("update");
          if (!vehicle) throw new RequestError("The currently assigned vehicle no longer exists.", 409);

          const hasVehicleHistory = segments.length > 1;
          if (hasVehicleHistory && startAt.getTime() !== booking.startAt.getTime()) {
            throw new RequestError("The original rental start is locked after a real vehicle change. Current vehicle details and expected return can still be edited.", 409);
          }
          const segmentStartAt = hasVehicleHistory ? activeSegment.startAt : startAt;
          if (endAt <= segmentStartAt) throw new RequestError("Expected return must be after the current vehicle segment started.", 409);

          const [bookingOverlap] = await tx.select({ number: bookings.bookingNumber }).from(bookings).where(and(
            eq(bookings.vehicleId, activeSegment.vehicleId),
            ne(bookings.id, bookingId),
            eq(bookings.status, "booked"),
            lt(bookings.startAt, endAt),
            gt(bookings.endAt, segmentStartAt),
          )).limit(1);
          const [activeConflict] = await tx.select({ number: bookings.bookingNumber }).from(rentalSegments)
            .innerJoin(bookings, eq(rentalSegments.bookingId, bookings.id))
            .where(and(
              eq(rentalSegments.vehicleId, activeSegment.vehicleId),
              eq(rentalSegments.status, "active"),
              ne(rentalSegments.bookingId, bookingId),
              lt(rentalSegments.startAt, endAt),
            )).limit(1);
          if (activeConflict) throw new RequestError(`The corrected rental conflicts with active rental ${activeConflict.number}.`, 409);

          const rentalDays = rentalDaysFromSchedule(startAt, endAt);
          const activeProjection = calculateSegmentCharge({
            startAt: segmentStartAt,
            endAt,
            dailyRate,
            startingKilometer,
            endingKilometer: startingKilometer,
            allowedKmPerDay,
            extraKmRate,
          });
          const completedSegments = segments.filter((segment) => segment.status !== "active");
          const completedGross = roundMoney(completedSegments.reduce((sum, segment) => sum + segment.rentalCharge, 0));
          const completedExtraKm = roundMoney(completedSegments.reduce((sum, segment) => sum + segment.extraKmCharge, 0));
          const grossRentalAmount = roundMoney((hasVehicleHistory ? completedGross : 0) + activeProjection.rentalCharge);
          if (bookingDiscount > grossRentalAmount) throw new RequestError("Booking discount cannot exceed the recalculated rental amount.", 409);
          const baseRentalAmount = roundMoney(grossRentalAmount - bookingDiscount);
          const expectedReturnKilometer = calculateExpectedReturnKilometer(startingKilometer, activeProjection.rentalDays, allowedKmPerDay);

          const [paidRow] = await tx.select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)::float8` }).from(payments).where(eq(payments.bookingId, bookingId));
          const paid = Number(paidRow?.total ?? 0);
          const lateMs = Math.max(0, Date.now() - endAt.getTime() - 3 * 60 * 60 * 1000);
          const liveLateDays = lateMs > 0 ? Math.ceil(lateMs / 86_400_000) : 0;
          const currentPayable = roundMoney(baseRentalAmount + otherCharges + completedExtraKm + liveLateDays * dailyRate);
          if (paid > currentPayable + 0.001) {
            throw new RequestError(`The rental already has ₹${paid.toLocaleString("en-IN")} recorded as paid. These edits would reduce the current bill below that amount.`, 409);
          }

          await tx.update(rentalSegments).set({
            startAt: segmentStartAt,
            startingKilometer,
            startingFuelRangeKm,
            dailyRate,
            allowedKmPerDay,
            extraKmRate,
            updatedAt: new Date(),
          }).where(eq(rentalSegments.id, activeSegment.id));

          await tx.update(bookings).set({
            customerId,
            startAt,
            endAt,
            rentalDays,
            dailyRate: hasVehicleHistory ? booking.dailyRate : dailyRate,
            baseRentalAmount,
            bookingDiscount,
            otherCharges,
            securityDeposit,
            startingKilometer: hasVehicleHistory ? booking.startingKilometer : startingKilometer,
            startingFuelRangeKm: hasVehicleHistory ? booking.startingFuelRangeKm : startingFuelRangeKm,
            expectedReturnKilometer,
            updatedAt: new Date(),
          }).where(eq(bookings.id, bookingId));

          if (customerId !== booking.customerId) {
            await tx.update(payments).set({ customerId }).where(eq(payments.bookingId, bookingId));
          }
          await tx.update(vehicles).set({ odometerKm: startingKilometer, status: "rented", updatedAt: new Date() }).where(eq(vehicles.id, vehicle.id));

          return {
            bookingNumber: booking.bookingNumber,
            customer: customer.name,
            rentalDays,
            baseRentalAmount,
            expectedReturnKilometer,
            scheduleWarning: bookingOverlap ? `Overlaps ${bookingOverlap.number}. Calendar will show Change required.` : null,
          };
        });

        return Response.json({ ok: true, rental: result, scheduleWarning: result.scheduleWarning });
      });
    }

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

        // MECARDEE_SETTINGS_SOFT_BOOKING_OVERLAP_V8_9_48
        // A FUTURE booking overlap is only a planning warning. This mirrors the
        // normal booking flow: keep the active rental, keep the future booking,
        // and let the calendar/dashboard mark the collision as CHANGE REQUIRED.
        // Only a real active-rental collision is blocked below.
        const [bookingOverlap] = await tx.select({ id: bookings.id, number: bookings.bookingNumber }).from(bookings).where(and(
          eq(bookings.vehicleId, actualVehicleId),
          ne(bookings.id, bookingId),
          eq(bookings.status, "booked"),
          lt(bookings.startAt, endAt),
          gt(bookings.endAt, activeSegment?.startAt ?? startAt),
        )).limit(1);

        const [rentalOverlap] = await tx.select({ id: rentalSegments.id, number: bookings.bookingNumber }).from(rentalSegments)
          .innerJoin(bookings, eq(rentalSegments.bookingId, bookings.id))
          .where(and(
            eq(rentalSegments.vehicleId, actualVehicleId),
            eq(rentalSegments.status, "active"),
            ne(rentalSegments.bookingId, bookingId),
            lt(rentalSegments.startAt, endAt),
          )).limit(1);
        if (rentalOverlap) throw new RequestError(`The corrected schedule overlaps active rental ${rentalOverlap.number}.`, 409);

        const rentalDays = rentalDaysFromSchedule(startAt, endAt);
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

        if (segments.length === 1 && activeSegment) {
          await tx.update(rentalSegments).set({ startAt, updatedAt: new Date() }).where(eq(rentalSegments.id, activeSegment.id));
        }

        return { bookingId, bookingNumber: booking.bookingNumber, rentalDays, baseRentalAmount, startAt: startAt.toISOString(), endAt: endAt.toISOString(), scheduleWarning: bookingOverlap ? `Overlaps ${bookingOverlap.number}. Calendar will show Change required.` : null };
      });
      return Response.json({ ok: true, rental: result, rentalDays: result.rentalDays, baseRentalAmount: result.baseRentalAmount, scheduleWarning: result.scheduleWarning });
    });
  } catch (error) {
    if (error instanceof RequestError) return Response.json({ ok: false, error: error.message }, { status: error.status });
    if (error instanceof DatabaseConfigurationError) return Response.json({ ok: false, error: error.message }, { status: 503 });
    console.error("Could not edit/correct rental", error);
    return Response.json({ ok: false, error: "Could not update the rental." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const __mecardeeAuth = await requireSuperAdminAccess();
  if (!__mecardeeAuth.ok) return __mecardeeAuth.response;
  try {
    const body = await request.json() as AnyRow;
    const action = text(body.action, "Action").toLowerCase();
    if (action !== "reopen-return") throw new RequestError("Rental correction action is invalid.");
    const bookingId = text(body.bookingId, "Rental ID");
    const reason = text(body.reason, "Correction reason");
    if (reason.length < 3) throw new RequestError("Please enter a short reason for reopening this return.");

    return await withRequestDb(async (db) => {
      await ensureRentalReopenHistoryTable(db);
      const result = await db.transaction(async (tx) => {
        const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1).for("update");
        if (!booking) throw new RequestError("Rental was not found.", 404);
        if (booking.status !== "completed") throw new RequestError("Only a completed rental can be reopened.", 409);

        const [settlement] = await tx.select().from(returnSettlements).where(eq(returnSettlements.bookingId, bookingId)).limit(1).for("update");
        if (!settlement) throw new RequestError("This completed rental has no Final Settlement to reopen.", 409);

        const segments = await tx.select().from(rentalSegments).where(eq(rentalSegments.bookingId, bookingId)).orderBy(rentalSegments.sequence);
        const finalSegment = segments.at(-1);
        if (!finalSegment || finalSegment.status !== "completed") {
          throw new RequestError("The final completed vehicle segment could not be found. Reopen was blocked.", 409);
        }

        const [vehicle] = await tx.select().from(vehicles).where(eq(vehicles.id, finalSegment.vehicleId)).limit(1).for("update");
        if (!vehicle) throw new RequestError("The final vehicle no longer exists. Reopen was blocked.", 409);
        const [activeConflict] = await tx.select({ number: bookings.bookingNumber }).from(rentalSegments)
          .innerJoin(bookings, eq(rentalSegments.bookingId, bookings.id))
          .where(and(
            eq(rentalSegments.vehicleId, vehicle.id),
            eq(rentalSegments.status, "active"),
            ne(rentalSegments.bookingId, bookingId),
          )).limit(1);
        if (activeConflict) throw new RequestError(`${vehicle.name} is already assigned to active rental ${activeConflict.number}. Reopen was blocked.`, 409);

        const paymentRows = await tx.select().from(payments).where(eq(payments.bookingId, bookingId));
        const extensionRows = await tx.select().from(rentalExtensions).where(eq(rentalExtensions.bookingId, bookingId));
        const auditSnapshot = { booking, settlement, segments, vehicle, payments: paymentRows, extensions: extensionRows };
        await tx.execute(sql`
          INSERT INTO rental_reopen_history
            (id, booking_id, booking_number, reason, snapshot, reopened_by)
          VALUES
            (${crypto.randomUUID()}::uuid, ${booking.id}::uuid, ${booking.bookingNumber}, ${reason}, ${JSON.stringify(auditSnapshot)}::jsonb, ${__mecardeeAuth.user.username})
        `);

        await tx.delete(returnSettlements).where(eq(returnSettlements.id, settlement.id));
        await tx.update(rentalSegments).set({
          endAt: null,
          endingKilometer: null,
          returnFuelRangeKm: null,
          fuelRangeShortageKm: 0,
          fuelCharge: 0,
          rentalDays: 1,
          rentalCharge: 0,
          extraKilometers: 0,
          extraKmCharge: 0,
          status: "active",
          updatedAt: new Date(),
        }).where(eq(rentalSegments.id, finalSegment.id));
        await tx.update(bookings).set({ status: "rented", completedAt: null, updatedAt: new Date() }).where(eq(bookings.id, bookingId));
        // Keep the most recently recorded odometer reading; only the false return
        // state is removed. This avoids losing a legitimate meter reading.
        await tx.update(vehicles).set({ status: "rented", updatedAt: new Date() }).where(eq(vehicles.id, vehicle.id));

        return {
          bookingNumber: booking.bookingNumber,
          vehicle: vehicle.name,
          plate: vehicle.registrationNumber,
          paymentsKept: paymentRows.length,
        };
      });

      return Response.json({ ok: true, reopened: result });
    });
  } catch (error) {
    if (error instanceof RequestError) return Response.json({ ok: false, error: error.message }, { status: error.status });
    if (error instanceof DatabaseConfigurationError) return Response.json({ ok: false, error: error.message }, { status: 503 });
    console.error("Could not reopen completed rental", error);
    return Response.json({ ok: false, error: "Could not safely reopen the completed rental." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const __mecardeeAuth = await requireSuperAdminAccess();
  if (!__mecardeeAuth.ok) return __mecardeeAuth.response;
  try {
    const body = await request.json() as AnyRow;
    const bookingId = text(body.bookingId, "Rental ID");

    return await withRequestDb(async (db) => {
      const result = await db.transaction(async (tx) => {
        const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1).for("update");
        if (!booking) throw new RequestError("Rental was not found.", 404);
        if (booking.status !== "rented") throw new RequestError("Only an active/on-rent rental can be returned to Booked.", 409);

        const [settlement] = await tx.select({ id: returnSettlements.id }).from(returnSettlements).where(eq(returnSettlements.bookingId, bookingId)).limit(1);
        if (settlement) throw new RequestError("This rental already has a Final Settlement and cannot be undone.", 409);

        const segments = await tx.select().from(rentalSegments).where(eq(rentalSegments.bookingId, bookingId)).orderBy(rentalSegments.sequence);
        if (segments.length !== 1 || segments[0]?.status !== "active") {
          throw new RequestError("Undo Start is only available before any real vehicle change/history exists. Use normal correction tools for this rental.", 409);
        }

        const [extension] = await tx.select({ id: rentalExtensions.id }).from(rentalExtensions).where(eq(rentalExtensions.bookingId, bookingId)).limit(1);
        if (extension) throw new RequestError("This rental already has an extension and cannot safely be returned to Booked.", 409);

        const paymentRows = await tx.select().from(payments).where(eq(payments.bookingId, bookingId));
        const nonAdvance = paymentRows.find((payment) => payment.paymentType !== "advance");
        if (nonAdvance) {
          throw new RequestError("This rental has payment activity beyond the original handover advance. Undo Start was blocked to protect the accounts.", 409);
        }

        const segment = segments[0];
        await tx.delete(payments).where(eq(payments.bookingId, bookingId));
        await tx.delete(rentalSegments).where(eq(rentalSegments.id, segment.id));
        await tx.update(vehicles).set({ status: "available", updatedAt: new Date() }).where(eq(vehicles.id, segment.vehicleId));

        await tx.update(bookings).set({
          status: "booked",
          advancePaid: 0,
          securityDeposit: 0,
          startingKilometer: null,
          startingFuelRangeKm: null,
          expectedReturnKilometer: null,
          handedOverAt: null,
          completedAt: null,
          updatedAt: new Date(),
        }).where(eq(bookings.id, bookingId));

        return { bookingNumber: booking.bookingNumber };
      });

      return Response.json({ ok: true, bookingNumber: result.bookingNumber });
    });
  } catch (error) {
    if (error instanceof RequestError) return Response.json({ ok: false, error: error.message }, { status: error.status });
    if (error instanceof DatabaseConfigurationError) return Response.json({ ok: false, error: error.message }, { status: 503 });
    console.error("Could not undo rental start", error);
    return Response.json({ ok: false, error: "Could not undo the rental start." }, { status: 500 });
  }
}
