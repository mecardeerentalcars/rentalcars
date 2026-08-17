import { eq } from "drizzle-orm";
import { DatabaseConfigurationError, withRequestDb } from "@/db";
import { vehicles } from "@/db/schema";

type VehicleBody = { name?: unknown; make?: unknown; registrationNumber?: unknown; imageUrl?: unknown; fuelType?: unknown; transmission?: unknown; modelYear?: unknown; dailyRate?: unknown; odometerKm?: unknown; allowedKmPerDay?: unknown; extraKmRate?: unknown; mileageKmPerLitre?: unknown; status?: unknown };
class RequestError extends Error { constructor(message: string, readonly status = 400) { super(message); } }
const text = (value: unknown, field: string) => { if (typeof value !== "string" || !value.trim()) throw new RequestError(`${field} is required.`); return value.trim(); };
const optionalText = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const number = (value: unknown, field: string, minimum = 0) => { const n = Number(value); if (!Number.isFinite(n) || n < minimum) throw new RequestError(`${field} must be ${minimum} or greater.`); return Math.round(n * 100) / 100; };
const whole = (value: unknown, field: string, minimum = 0) => { const n = Number(value); if (!Number.isInteger(n) || n < minimum) throw new RequestError(`${field} must be a whole number of ${minimum} or greater.`); return n; };

const manualVehicleStatus = (value: unknown) => {
  if (value === undefined || value === null || value === "") return "available";
  if (typeof value !== "string") throw new RequestError("Vehicle status is invalid.");
  const normalized = value.trim().toLowerCase();
  if (normalized === "active") return "available";
  if (["available", "inactive", "maintenance"].includes(normalized)) return normalized;
  throw new RequestError("Vehicle status can only be Active, Inactive or Maintenance.");
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as VehicleBody;
    const name = text(body.name, "Vehicle name");
    const make = text(body.make, "Make");
    const registrationNumber = text(body.registrationNumber, "Registration number").toUpperCase();
    const fuelType = text(body.fuelType, "Fuel type");
    const transmission = text(body.transmission, "Transmission");
    const modelYear = whole(body.modelYear, "Model year", 1980);
    const dailyRate = number(body.dailyRate, "Daily rate", 1);
    const odometerKm = whole(body.odometerKm ?? 0, "Odometer");
    const allowedKmPerDay = whole(body.allowedKmPerDay ?? 100, "Allowed KM per day", 1);
    const extraKmRate = number(body.extraKmRate ?? 0, "Extra KM rate");
    const mileageKmPerLitre = number(body.mileageKmPerLitre ?? 1, "Mileage", 0.1);
    const imageUrl = optionalText(body.imageUrl);
    const status = manualVehicleStatus(body.status);

    const saved = await withRequestDb(async (db) => {
      const [duplicate] = await db
        .select({ id: vehicles.id })
        .from(vehicles)
        .where(eq(vehicles.registrationNumber, registrationNumber))
        .limit(1);
      if (duplicate) throw new RequestError("A vehicle with this registration number already exists.", 409);

      const [vehicle] = await db
        .insert(vehicles)
        .values({
          name,
          make,
          registrationNumber,
          imageUrl,
          fuelType,
          transmission,
          modelYear,
          dailyRate,
          odometerKm,
          allowedKmPerDay,
          extraKmRate,
          mileageKmPerLitre,
          status,
        })
        .returning({ id: vehicles.id, name: vehicles.name, registrationNumber: vehicles.registrationNumber });

      if (!vehicle) throw new Error("PostgreSQL did not return the created vehicle.");
      return vehicle;
    });

    return Response.json({ ok: true, vehicle: { id: saved.id, name: saved.name, plate: saved.registrationNumber } }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestError) return Response.json({ ok: false, error: error.message }, { status: error.status });
    if (error instanceof DatabaseConfigurationError) return Response.json({ ok: false, error: error.message }, { status: 503 });
    console.error("Could not save vehicle", error);
    const message = process.env.NODE_ENV === "development" && error instanceof Error
      ? `Could not save the vehicle. ${error.message}`
      : "Could not save the vehicle.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
