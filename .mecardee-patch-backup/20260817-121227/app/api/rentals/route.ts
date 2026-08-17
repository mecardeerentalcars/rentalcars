import { and, eq, gt, inArray, lt } from "drizzle-orm";
import { DatabaseConfigurationError, getDb } from "@/db";
import { bookings, customers, vehicles } from "@/db/schema";
import { calculateExpectedReturnKilometer } from "@/lib/rental-calculations";

type CreateRentalBody = {
  vehicleRegistration?: unknown;
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

const amount = (value: unknown, field: string) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new RequestError(`${field} must be zero or greater.`);
  return Math.round(number * 100) / 100;
};

const wholeNumber = (value: unknown, field: string, minimum = 0) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum) {
    throw new RequestError(`${field} must be a whole number of at least ${minimum}.`);
  }
  return number;
};

const date = (value: unknown, field: string) => {
  const result = new Date(text(value, field));
  if (Number.isNaN(result.getTime())) throw new RequestError(`${field} is invalid.`);
  return result;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateRentalBody;
    const vehicleRegistration = text(body.vehicleRegistration, "Vehicle registration");
    const customerPhone = text(body.customerPhone, "Customer phone");
    const startAt = date(body.startAt, "Start date");
    const endAt = date(body.endAt, "Return date");
    const rentalDays = wholeNumber(body.rentalDays, "Rental days", 1);
    const dailyRate = amount(body.dailyRate, "Daily rate");
    const securityDeposit = amount(body.securityDeposit ?? 0, "Security deposit");
    const advancePaid = amount(body.advancePaid ?? 0, "Advance paid");
    const bookingDiscount = amount(body.bookingDiscount ?? 0, "Discount");
    const startingKilometer = wholeNumber(body.startingKilometer, "Starting kilometer");
    const startingFuelRangeKm = wholeNumber(body.startingFuelRangeKm, "Starting fuel range");

    if (endAt <= startAt) throw new RequestError("Return date must be after the start date.");
    const grossRentalAmount = Math.round(rentalDays * dailyRate * 100) / 100;
    if (bookingDiscount > grossRentalAmount) {
      throw new RequestError("Discount cannot exceed the rental amount.");
    }
    const baseRentalAmount = grossRentalAmount - bookingDiscount;

    const created = await getDb().transaction(async (tx) => {
      const [vehicle] = await tx
        .select()
        .from(vehicles)
        .where(eq(vehicles.registrationNumber, vehicleRegistration))
        .limit(1)
        .for("update");
      if (!vehicle) throw new RequestError("Vehicle was not found.", 404);
      if (vehicle.status !== "available") throw new RequestError("Vehicle is not currently available.", 409);

      const [overlap] = await tx
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(
            eq(bookings.vehicleId, vehicle.id),
            inArray(bookings.status, ["booked", "rented"]),
            lt(bookings.startAt, endAt),
            gt(bookings.endAt, startAt),
          ),
        )
        .limit(1);
      if (overlap) throw new RequestError("Vehicle is already booked for the selected dates.", 409);

      const [customer] = await tx
        .select()
        .from(customers)
        .where(eq(customers.phone, customerPhone))
        .limit(1);
      if (!customer) throw new RequestError("Customer was not found.", 404);

      const expectedReturnKilometer = calculateExpectedReturnKilometer(
        startingKilometer,
        rentalDays,
        vehicle.allowedKmPerDay,
      );
      const bookingNumber = `RNT-${Date.now().toString(36).toUpperCase()}`;
      const [booking] = await tx
        .insert(bookings)
        .values({
          bookingNumber,
          vehicleId: vehicle.id,
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
          status: "rented",
          handedOverAt: new Date(),
        })
        .returning();

      await tx
        .update(vehicles)
        .set({ status: "rented", odometerKm: startingKilometer, updatedAt: new Date() })
        .where(eq(vehicles.id, vehicle.id));

      return { bookingNumber, expectedReturnKilometer, allowedKmPerDay: vehicle.allowedKmPerDay };
    });

    return Response.json({ ok: true, rental: created }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestError) {
      return Response.json({ ok: false, error: error.message }, { status: error.status });
    }
    if (error instanceof DatabaseConfigurationError) {
      return Response.json({ ok: false, error: error.message }, { status: 503 });
    }
    console.error("Could not create rental", error);
    return Response.json({ ok: false, error: "Could not save the rental." }, { status: 500 });
  }
}
