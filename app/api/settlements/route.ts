// MECARDEE_ROLE_GUARD_V8_9_55
import { requireWriteAccess, requireSuperAdminAccess } from "@/lib/mecardee-auth";
// MECARDEE_SEGMENT_FUEL_FINAL_SETTLEMENT_V8_9_45
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { DatabaseConfigurationError, withRequestDb } from "@/db";
import { bookings, customers, maintenanceRecords, payments, rentalSegments, returnSettlements, vehicles } from "@/db/schema";
import {
  buildSettlementWhatsAppMessage,
  buildSettlementWhatsAppUrl,
  calculateLateRentalCharge,
  calculateRentalChargeForActualReturn,
  calculateSettlement,
  normalisePendingBalance,
} from "@/lib/rental-calculations";
import { calculateSegmentCharge, roundFinalPayable } from "@/lib/rental-segments";

type SettlementBody = {
  bookingNumber?: unknown;
  actualReturnAt?: unknown;
  actualReturnKilometer?: unknown;
  returnFuelRangeKm?: unknown;
  fuelPricePerLitre?: unknown;
  lateFee?: unknown;
  cleaningCharge?: unknown;
  damageCharge?: unknown;
  discountAmount?: unknown;
  discountRemark?: unknown;
  returnNotes?: unknown;
  vehicleCondition?: unknown;
  sendToMaintenance?: unknown;
};

class RequestError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
const text = (value: unknown, field: string) => {
  if (typeof value !== "string" || !value.trim()) throw new RequestError(`${field} is required.`);
  return value.trim();
};
const optionalText = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const amount = (value: unknown, field: string) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new RequestError(`${field} must be zero or greater.`);
  return Math.round(number * 100) / 100;
};
const wholeNumber = (value: unknown, field: string) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new RequestError(`${field} must be a whole number of zero or greater.`);
  return number;
};
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const displayDate = (value: Date) =>
  new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(value);

async function saveSettlement(request: Request, editCompleted: boolean) {
  const __mecardeeAuth = editCompleted ? await requireSuperAdminAccess() : await requireWriteAccess();
  if (!__mecardeeAuth.ok) return __mecardeeAuth.response;
  try {
    const body = (await request.json()) as SettlementBody;
    const bookingNumber = text(body.bookingNumber, "Booking number");
    const actualReturnAt = new Date(text(body.actualReturnAt, "Actual return date"));
    if (Number.isNaN(actualReturnAt.getTime())) throw new RequestError("Actual return date is invalid.");
    const actualReturnKilometer = wholeNumber(body.actualReturnKilometer, "Actual return kilometer");
    const returnFuelRangeKm = wholeNumber(body.returnFuelRangeKm, "Return fuel range");
    const fuelPricePerLitre = amount(body.fuelPricePerLitre, "Fuel price per litre");
    const cleaningCharge = amount(body.cleaningCharge ?? 0, "Cleaning charge");
    const damageCharge = amount(body.damageCharge ?? 0, "Damage charge");
    const discountAmount = amount(body.discountAmount ?? 0, "Discount amount");
    const discountRemark = optionalText(body.discountRemark);
    const returnNotes = optionalText(body.returnNotes);
    const vehicleCondition = optionalText(body.vehicleCondition);
    const requestedMaintenance = body.sendToMaintenance === true;

    const saved = await withRequestDb((db) => db.transaction(async (tx) => {
      const [record] = await tx
        .select({ booking: bookings, originalVehicle: vehicles, customer: customers })
        .from(bookings)
        .innerJoin(vehicles, eq(bookings.vehicleId, vehicles.id))
        .innerJoin(customers, eq(bookings.customerId, customers.id))
        .where(eq(bookings.bookingNumber, bookingNumber))
        .limit(1)
        .for("update");

      if (!record) throw new RequestError("Rental booking was not found.", 404);
      if (editCompleted && record.booking.status !== "completed") throw new RequestError("Only a completed rental settlement can be edited.", 409);
      if (!editCompleted && record.booking.status === "completed") throw new RequestError("This rental has already been completed.", 409);
      if (record.booking.status === "draft") throw new RequestError("A draft rental cannot be returned.", 409);
      if (actualReturnAt.getTime() < record.booking.startAt.getTime()) {
        throw new RequestError("Actual return date/time cannot be before the rental start date/time.");
      }
      if (record.booking.startingFuelRangeKm === null) {
        throw new RequestError("Starting fuel range must be saved at handover.", 409);
      }

      const [existingSettlement] = await tx
        .select()
        .from(returnSettlements)
        .where(eq(returnSettlements.bookingId, record.booking.id))
        .limit(1)
        .for("update");
      if (editCompleted && !existingSettlement) throw new RequestError("This completed rental has no settlement to edit.", 409);
      if (!editCompleted && existingSettlement) throw new RequestError("This rental already has a settlement.", 409);

      let segmentRows = await tx
        .select({ segment: rentalSegments, vehicle: vehicles })
        .from(rentalSegments)
        .innerJoin(vehicles, eq(rentalSegments.vehicleId, vehicles.id))
        .where(eq(rentalSegments.bookingId, record.booking.id))
        .orderBy(asc(rentalSegments.sequence))
        .for("update");

      // Safety for a database upgraded while an old rental was already running.
      if (!segmentRows.length) {
        const startingKilometer = record.booking.startingKilometer ?? record.originalVehicle.odometerKm;
        const [created] = await tx.insert(rentalSegments).values({
          bookingId: record.booking.id,
          sequence: 1,
          vehicleId: record.originalVehicle.id,
          startAt: record.booking.startAt,
          startingKilometer,
          startingFuelRangeKm: record.booking.startingFuelRangeKm ?? 0,
          dailyRate: record.booking.dailyRate,
          rentalDays: Math.max(1, record.booking.rentalDays),
          rentalCharge: 0,
          allowedKmPerDay: record.originalVehicle.allowedKmPerDay,
          extraKmRate: record.originalVehicle.extraKmRate,
          status: "active",
        }).returning();
        segmentRows = [{ segment: created, vehicle: record.originalVehicle }];
      }

      const currentRow = editCompleted
        ? [...segmentRows].reverse().find((row) => row.segment.status === "completed")
        : [...segmentRows].reverse().find((row) => row.segment.status === "active");
      if (!currentRow) throw new RequestError(`The ${editCompleted ? "final completed" : "active"} vehicle segment could not be found.`, 409);
      const currentSegment = currentRow.segment;
      const currentVehicle = currentRow.vehicle;
      if (actualReturnAt.getTime() < currentSegment.startAt.getTime()) {
        throw new RequestError("Actual return date/time cannot be before the current vehicle segment started.");
      }
      if (actualReturnKilometer < currentSegment.startingKilometer) {
        throw new RequestError("Actual return kilometer cannot be below the current vehicle starting kilometer.");
      }
      if (currentVehicle.mileageKmPerLitre <= 0) throw new RequestError("Vehicle mileage must be configured before settlement.", 409);

      const [paidRow] = await tx
        .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)::float8` })
        .from(payments)
        .where(eq(payments.bookingId, record.booking.id));
      const amountAlreadyPaid = Number(paidRow?.total ?? 0);

      const singleOriginalSegment =
        segmentRows.length === 1 &&
        currentSegment.vehicleId === record.booking.requestedVehicleId;

      const currentSegmentCharge = calculateSegmentCharge({
        startAt: currentSegment.startAt,
        endAt: actualReturnAt,
        dailyRate: currentSegment.dailyRate,
        startingKilometer: currentSegment.startingKilometer,
        endingKilometer: actualReturnKilometer,
        allowedKmPerDay: currentSegment.allowedKmPerDay,
        extraKmRate: currentSegment.extraKmRate,
      });

      const completedRows = segmentRows.filter((row) => row.segment.id !== currentSegment.id);
      const completedRentalCharge = roundMoney(completedRows.reduce((sum, row) => sum + row.segment.rentalCharge, 0));
      const completedExtraKmCharge = roundMoney(completedRows.reduce((sum, row) => sum + row.segment.extraKmCharge, 0));

      let rentalBaseAmount: number;
      let lateRentalDays = 0;
      let lateFee = 0;
      let earlyReturn = false;
      let chargeableRentalDays = currentSegmentCharge.rentalDays;
      let earlyReturnSaving = 0;

      if (singleOriginalSegment) {
        // Preserve the pre-existing one-vehicle settlement calculation exactly.
        const legacyRentalCharge = calculateRentalChargeForActualReturn(
          record.booking.startAt,
          record.booking.endAt,
          actualReturnAt,
          record.booking.dailyRate,
          record.booking.rentalDays,
          record.booking.baseRentalAmount,
        );
        const lateRental = calculateLateRentalCharge(
          record.booking.endAt,
          actualReturnAt,
          record.booking.dailyRate,
          3,
        );
        rentalBaseAmount = legacyRentalCharge.baseRentalAmount;
        lateRentalDays = lateRental.extraRentalDays;
        lateFee = lateRental.charge;
        earlyReturn = legacyRentalCharge.isEarlyReturn;
        chargeableRentalDays = legacyRentalCharge.chargeableRentalDays;
        earlyReturnSaving = legacyRentalCharge.amountSaved;
      } else {
        // Multi-vehicle rental: each segment is charged independently with the
        // existing daily/cooling rule. Apply the original booking discount once.
        const segmentGross = roundMoney(completedRentalCharge + currentSegmentCharge.rentalCharge);
        rentalBaseAmount = roundMoney(Math.max(0, segmentGross - Math.min(record.booking.bookingDiscount, segmentGross)));
      }

      const calculationRaw = calculateSettlement({
        baseRentalAmount: rentalBaseAmount,
        existingOtherCharges: roundMoney(record.booking.otherCharges + completedExtraKmCharge),
        rentalDays: currentSegmentCharge.rentalDays,
        startingKilometer: currentSegment.startingKilometer,
        actualReturnKilometer,
        allowedKmPerDay: currentSegment.allowedKmPerDay,
        extraKmRate: currentSegment.extraKmRate,
        startingFuelRangeKm: currentSegment.startingFuelRangeKm,
        returnFuelRangeKm,
        mileageKmPerLitre: currentVehicle.mileageKmPerLitre,
        fuelPricePerLitre,
        lateFee,
        cleaningCharge,
        damageCharge,
        discountAmount,
        amountAlreadyPaid,
      });
      if (discountAmount > calculationRaw.subtotal) throw new RequestError("Discount cannot exceed the subtotal.");

      // Only the final payable is rounded; every detailed calculation above keeps
      // its existing precision.
      const roundedFinalAmount = roundFinalPayable(calculationRaw.finalAmount);
      const calculation = {
        ...calculationRaw,
        finalAmount: roundedFinalAmount,
        amountDue: normalisePendingBalance(roundedFinalAmount - amountAlreadyPaid),
      };

      const storedCurrentRentalDays = singleOriginalSegment
        ? chargeableRentalDays
        : currentSegmentCharge.rentalDays;
      const storedCurrentRentalCharge = singleOriginalSegment
        ? roundMoney(chargeableRentalDays * currentSegment.dailyRate)
        : currentSegmentCharge.rentalCharge;

      const sendToMaintenance = requestedMaintenance && !currentVehicle.isGuest;
      const [newerVehicleSegment] = editCompleted
        ? await tx
          .select({ id: rentalSegments.id })
          .from(rentalSegments)
          .where(and(
            eq(rentalSegments.vehicleId, currentVehicle.id),
            gt(rentalSegments.startAt, currentSegment.startAt),
          ))
          .orderBy(asc(rentalSegments.startAt))
          .limit(1)
          .for("update")
        : [];
      const vehicleCanBeSynchronized = !editCompleted || (
        ["available", "maintenance"].includes(currentVehicle.status) &&
        !newerVehicleSegment
      );
      if (editCompleted && existingSettlement!.sendToMaintenance !== sendToMaintenance && !vehicleCanBeSynchronized) {
        throw new RequestError("This vehicle has newer activity. Its maintenance status cannot be changed from this historical settlement.", 409);
      }

      const settlementValues = {
          bookingId: record.booking.id,
          actualReturnAt,
          actualReturnKilometer,
          allowedKilometers: calculation.allowedKilometers,
          expectedReturnKilometer: calculation.expectedReturnKilometer,
          extraKilometers: calculation.extraKilometers,
          extraKmRate: currentSegment.extraKmRate,
          extraKmCharge: calculation.extraKmCharge,
          startingFuelRangeKm: currentSegment.startingFuelRangeKm,
          returnFuelRangeKm,
          fuelRangeShortageKm: calculation.fuelRangeShortageKm,
          mileageKmPerLitre: currentVehicle.mileageKmPerLitre,
          requiredFuelLitres: calculation.requiredFuelLitres,
          fuelPricePerLitre,
          fuelCharge: calculation.fuelCharge,
          lateFee,
          cleaningCharge,
          damageCharge,
          vehicleCondition,
          subtotal: calculation.subtotal,
          discountAmount,
          discountRemark,
          finalAmount: roundedFinalAmount,
          returnNotes,
          sendToMaintenance,
        };
      const [settlement] = editCompleted
        ? await tx.update(returnSettlements).set(settlementValues).where(eq(returnSettlements.id, existingSettlement!.id)).returning()
        : await tx.insert(returnSettlements).values(settlementValues).returning();

      await tx.update(rentalSegments).set({
        endAt: actualReturnAt,
        endingKilometer: actualReturnKilometer,
        rentalDays: storedCurrentRentalDays,
        // For the legacy one-vehicle case store the gross booked-day charge so
        // old booking discounts remain represented once at the booking level.
        rentalCharge: storedCurrentRentalCharge,
        extraKilometers: calculation.extraKilometers,
        extraKmCharge: calculation.extraKmCharge,
        returnFuelRangeKm,
        fuelRangeShortageKm: calculation.fuelRangeShortageKm,
        fuelPricePerLitre,
        fuelCharge: calculation.fuelCharge,
        status: "completed",
        updatedAt: new Date(),
      }).where(eq(rentalSegments.id, currentSegment.id));

      await tx.update(bookings).set({
        status: "completed",
        completedAt: actualReturnAt,
        updatedAt: new Date(),
      }).where(eq(bookings.id, record.booking.id));

      if (vehicleCanBeSynchronized) {
        await tx.update(vehicles).set({
          status: sendToMaintenance ? "maintenance" : "available",
          odometerKm: actualReturnKilometer,
          updatedAt: new Date(),
        }).where(eq(vehicles.id, currentVehicle.id));
      }

      if (sendToMaintenance && (!editCompleted || !existingSettlement!.sendToMaintenance)) {
        await tx.insert(maintenanceRecords).values({
          vehicleId: currentVehicle.id,
          title: "Return inspection — maintenance",
          description: returnNotes ?? vehicleCondition ?? "Vehicle marked for maintenance during return settlement.",
          status: "open",
          amount: 0,
        });
      } else if (editCompleted && existingSettlement!.sendToMaintenance && !sendToMaintenance && vehicleCanBeSynchronized) {
        await tx.update(maintenanceRecords).set({ status: "completed", completedAt: new Date(), updatedAt: new Date() }).where(and(
          eq(maintenanceRecords.vehicleId, currentVehicle.id),
          eq(maintenanceRecords.title, "Return inspection — maintenance"),
          eq(maintenanceRecords.status, "open"),
        ));
      }

      const finalSegments = segmentRows.map((row) => {
        const isCurrent = row.segment.id === currentSegment.id;
        const segmentEnd = isCurrent ? actualReturnAt : (row.segment.endAt ?? actualReturnAt);
        const rentalDays = isCurrent ? storedCurrentRentalDays : row.segment.rentalDays;
        const rentalCharge = isCurrent
          ? (singleOriginalSegment ? rentalBaseAmount : currentSegmentCharge.rentalCharge)
          : row.segment.rentalCharge;
        const extraKmCharge = isCurrent ? calculation.extraKmCharge : row.segment.extraKmCharge;
        return {
          sequence: row.segment.sequence,
          vehicleId: row.vehicle.id,
          vehicleName: row.vehicle.name,
          registrationNumber: row.vehicle.registrationNumber,
          isGuest: row.vehicle.isGuest,
          bookingStart: displayDate(row.segment.startAt),
          bookingEnd: displayDate(segmentEnd),
          startAt: row.segment.startAt.toISOString(),
          endAt: segmentEnd.toISOString(),
          startingKilometer: row.segment.startingKilometer,
          endingKilometer: isCurrent ? actualReturnKilometer : row.segment.endingKilometer,
          startingFuelRangeKm: row.segment.startingFuelRangeKm,
          returnFuelRangeKm: isCurrent ? returnFuelRangeKm : row.segment.returnFuelRangeKm,
          fuelRangeShortageKm: isCurrent ? calculation.fuelRangeShortageKm : row.segment.fuelRangeShortageKm,
          fuelPricePerLitre: isCurrent ? fuelPricePerLitre : row.segment.fuelPricePerLitre,
          fuelCharge: isCurrent ? calculation.fuelCharge : row.segment.fuelCharge,
          rentalDays,
          rentalCharge,
          extraKilometers: isCurrent ? calculation.extraKilometers : row.segment.extraKilometers,
          extraKmCharge,
        };
      });

      const whatsappInput = {
        customerName: record.customer.name,
        phone: record.customer.whatsappNumber ?? record.customer.phone,
        vehicleName: currentVehicle.name,
        registrationNumber: currentVehicle.registrationNumber,
        bookingNumber: record.booking.bookingNumber,
        bookingStart: displayDate(record.booking.startAt),
        bookingEnd: displayDate(actualReturnAt),
        rentalDays: singleOriginalSegment ? chargeableRentalDays : finalSegments.reduce((sum, segment) => sum + segment.rentalDays, 0),
        startingKilometer: currentSegment.startingKilometer,
        actualReturnKilometer,
        startingFuelRangeKm: currentSegment.startingFuelRangeKm,
        returnFuelRangeKm,
        rentalAmount: rentalBaseAmount,
        discountAmount,
        discountRemark,
        calculation,
        segments: finalSegments,
      };

      return {
        settlementId: settlement.id,
        bookingNumber,
        vehicleStatus: sendToMaintenance ? "maintenance" : "available",
        amountAlreadyPaid,
        lateRentalDays,
        lateRentalCharge: lateFee,
        earlyReturn,
        chargeableRentalDays,
        adjustedRentalAmount: rentalBaseAmount,
        earlyReturnSaving,
        calculation,
        segments: finalSegments,
        whatsappMessage: buildSettlementWhatsAppMessage(whatsappInput),
        whatsappUrl: buildSettlementWhatsAppUrl(whatsappInput),
      };
    }));

    return Response.json({ ok: true, settlement: saved }, { status: editCompleted ? 200 : 201 });
  } catch (error) {
    if (error instanceof RequestError) return Response.json({ ok: false, error: error.message }, { status: error.status });
    if (error instanceof DatabaseConfigurationError) return Response.json({ ok: false, error: error.message }, { status: 503 });
    console.error(`Could not ${editCompleted ? "update" : "confirm"} return settlement`, error);
    return Response.json({ ok: false, error: `Could not ${editCompleted ? "update" : "confirm"} the return settlement.` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return saveSettlement(request, false);
}

export async function PATCH(request: Request) {
  return saveSettlement(request, true);
}
