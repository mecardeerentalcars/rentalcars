import { eq } from "drizzle-orm";
import { DatabaseConfigurationError, getDb } from "@/db";
import { bookings, customers, returnSettlements, vehicles } from "@/db/schema";
import {
  buildSettlementWhatsAppMessage,
  buildSettlementWhatsAppUrl,
  calculateSettlement,
} from "@/lib/rental-calculations";

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
  sendToMaintenance?: unknown;
};

class RequestError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
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
  if (!Number.isInteger(number) || number < 0) {
    throw new RequestError(`${field} must be a whole number of zero or greater.`);
  }
  return number;
};

const displayDate = (value: Date) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(value);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SettlementBody;
    const bookingNumber = text(body.bookingNumber, "Booking number");
    const actualReturnAt = new Date(text(body.actualReturnAt, "Actual return date"));
    if (Number.isNaN(actualReturnAt.getTime())) throw new RequestError("Actual return date is invalid.");
    const actualReturnKilometer = wholeNumber(body.actualReturnKilometer, "Actual return kilometer");
    const returnFuelRangeKm = wholeNumber(body.returnFuelRangeKm, "Return fuel range");
    const fuelPricePerLitre = amount(body.fuelPricePerLitre, "Fuel price per litre");
    const lateFee = amount(body.lateFee ?? 0, "Late fee");
    const cleaningCharge = amount(body.cleaningCharge ?? 0, "Cleaning charge");
    const damageCharge = amount(body.damageCharge ?? 0, "Damage charge");
    const discountAmount = amount(body.discountAmount ?? 0, "Discount amount");
    const discountRemark = optionalText(body.discountRemark);
    const returnNotes = optionalText(body.returnNotes);
    const sendToMaintenance = body.sendToMaintenance === true;

    const saved = await getDb().transaction(async (tx) => {
      const [record] = await tx
        .select({ booking: bookings, vehicle: vehicles, customer: customers })
        .from(bookings)
        .innerJoin(vehicles, eq(bookings.vehicleId, vehicles.id))
        .innerJoin(customers, eq(bookings.customerId, customers.id))
        .where(eq(bookings.bookingNumber, bookingNumber))
        .limit(1)
        .for("update");

      if (!record) throw new RequestError("Rental booking was not found.", 404);
      if (record.booking.status === "completed") {
        throw new RequestError("This rental has already been completed.", 409);
      }
      if (record.booking.startingKilometer === null || record.booking.startingFuelRangeKm === null) {
        throw new RequestError("Starting kilometer and fuel range must be saved at handover.", 409);
      }
      if (actualReturnKilometer < record.booking.startingKilometer) {
        throw new RequestError("Actual return kilometer cannot be below the starting kilometer.");
      }
      if (record.vehicle.mileageKmPerLitre <= 0) {
        throw new RequestError("Vehicle mileage must be configured before settlement.", 409);
      }

      const calculation = calculateSettlement({
        baseRentalAmount: record.booking.baseRentalAmount,
        existingOtherCharges: record.booking.otherCharges,
        rentalDays: record.booking.rentalDays,
        startingKilometer: record.booking.startingKilometer,
        actualReturnKilometer,
        allowedKmPerDay: record.vehicle.allowedKmPerDay,
        extraKmRate: record.vehicle.extraKmRate,
        startingFuelRangeKm: record.booking.startingFuelRangeKm,
        returnFuelRangeKm,
        mileageKmPerLitre: record.vehicle.mileageKmPerLitre,
        fuelPricePerLitre,
        lateFee,
        cleaningCharge,
        damageCharge,
        discountAmount,
        amountAlreadyPaid: record.booking.advancePaid,
      });
      if (discountAmount > calculation.subtotal) {
        throw new RequestError("Discount cannot exceed the subtotal.");
      }

      const [settlement] = await tx
        .insert(returnSettlements)
        .values({
          bookingId: record.booking.id,
          actualReturnAt,
          actualReturnKilometer,
          allowedKilometers: calculation.allowedKilometers,
          expectedReturnKilometer: calculation.expectedReturnKilometer,
          extraKilometers: calculation.extraKilometers,
          extraKmRate: record.vehicle.extraKmRate,
          extraKmCharge: calculation.extraKmCharge,
          startingFuelRangeKm: record.booking.startingFuelRangeKm,
          returnFuelRangeKm,
          fuelRangeShortageKm: calculation.fuelRangeShortageKm,
          mileageKmPerLitre: record.vehicle.mileageKmPerLitre,
          requiredFuelLitres: calculation.requiredFuelLitres,
          fuelPricePerLitre,
          fuelCharge: calculation.fuelCharge,
          lateFee,
          cleaningCharge,
          damageCharge,
          subtotal: calculation.subtotal,
          discountAmount,
          discountRemark,
          finalAmount: calculation.finalAmount,
          returnNotes,
          sendToMaintenance,
        })
        .returning();

      await tx
        .update(bookings)
        .set({ status: "completed", completedAt: actualReturnAt, updatedAt: new Date() })
        .where(eq(bookings.id, record.booking.id));
      await tx
        .update(vehicles)
        .set({
          status: sendToMaintenance ? "maintenance" : "available",
          odometerKm: actualReturnKilometer,
          updatedAt: new Date(),
        })
        .where(eq(vehicles.id, record.vehicle.id));

      const whatsappInput = {
        customerName: record.customer.name,
        phone: record.customer.whatsappNumber ?? record.customer.phone,
        vehicleName: record.vehicle.name,
        registrationNumber: record.vehicle.registrationNumber,
        bookingNumber: record.booking.bookingNumber,
        bookingStart: displayDate(record.booking.startAt),
        bookingEnd: displayDate(record.booking.endAt),
        rentalDays: record.booking.rentalDays,
        startingKilometer: record.booking.startingKilometer,
        actualReturnKilometer,
        startingFuelRangeKm: record.booking.startingFuelRangeKm,
        returnFuelRangeKm,
        rentalAmount: record.booking.baseRentalAmount,
        discountAmount,
        discountRemark,
        calculation,
      };

      return {
        settlementId: settlement.id,
        bookingNumber,
        vehicleStatus: sendToMaintenance ? "maintenance" : "available",
        calculation,
        whatsappMessage: buildSettlementWhatsAppMessage(whatsappInput),
        whatsappUrl: buildSettlementWhatsAppUrl(whatsappInput),
      };
    });

    return Response.json({ ok: true, settlement: saved }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestError) {
      return Response.json({ ok: false, error: error.message }, { status: error.status });
    }
    if (error instanceof DatabaseConfigurationError) {
      return Response.json({ ok: false, error: error.message }, { status: 503 });
    }
    console.error("Could not confirm return settlement", error);
    return Response.json({ ok: false, error: "Could not confirm the return settlement." }, { status: 500 });
  }
}
