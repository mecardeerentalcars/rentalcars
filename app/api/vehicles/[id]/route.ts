import { desc, eq, sql } from "drizzle-orm";
import { DatabaseConfigurationError, withRequestDb, type AppDb } from "@/db";
import {
  bookings,
  customers,
  expenses,
  maintenanceRecords,
  vehicleDocuments,
  vehicleTyres,
  vehicles,
} from "@/db/schema";

function messageFor(error: unknown, fallback: string) {
  return process.env.NODE_ENV === "development" && error instanceof Error ? `${fallback} ${error.message}` : fallback;
}

function postgresCode(error: unknown) {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth += 1) {
    const record = current as { code?: unknown; cause?: unknown };
    if (typeof record.code === "string") return record.code;
    current = record.cause;
  }
  return null;
}

function isMissingTyreTable(error: unknown) {
  if (postgresCode(error) === "42P01") return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes('relation "vehicle_tyres" does not exist');
}

async function ensureVehicleTyresTable(db: AppDb) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS vehicle_tyres (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      position varchar(32) NOT NULL,
      brand varchar(120),
      model varchar(120),
      size varchar(64),
      installed_date date,
      installed_odometer_km integer,
      tread_depth_mm numeric(5,2),
      replacement_due_date date,
      replacement_due_odometer_km integer,
      notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS vehicle_tyres_vehicle_position_unique ON vehicle_tyres(vehicle_id, position)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS vehicle_tyres_vehicle_idx ON vehicle_tyres(vehicle_id)`);
}

async function loadTyres(db: AppDb, vehicleId: string) {
  try {
    return await db.select().from(vehicleTyres).where(eq(vehicleTyres.vehicleId, vehicleId)).orderBy(vehicleTyres.position);
  } catch (error) {
    if (!isMissingTyreTable(error)) throw error;
    await ensureVehicleTyresTable(db);
    return await db.select().from(vehicleTyres).where(eq(vehicleTyres.vehicleId, vehicleId)).orderBy(vehicleTyres.position);
  }
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return await withRequestDb(async (db) => {
      const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
      if (!vehicle) return Response.json({ ok: false, error: "Vehicle not found." }, { status: 404 });

      // Core vehicle details must keep loading even if a newer optional table has
      // not been migrated yet. This is especially useful during rolling Railway deploys.
      const [documents, maintenance, rentalRows, expenseRows] = await Promise.all([
        db.select().from(vehicleDocuments).where(eq(vehicleDocuments.vehicleId, id)).orderBy(vehicleDocuments.documentType),
        db.select().from(maintenanceRecords).where(eq(maintenanceRecords.vehicleId, id)).orderBy(desc(maintenanceRecords.createdAt)),
        db
          .select({ booking: bookings, customer: customers })
          .from(bookings)
          .innerJoin(customers, eq(bookings.customerId, customers.id))
          .where(eq(bookings.vehicleId, id))
          .orderBy(desc(bookings.startAt)),
        db.select().from(expenses).where(eq(expenses.vehicleId, id)).orderBy(desc(expenses.expenseDate), desc(expenses.createdAt)),
      ]);

      let tyres: typeof vehicleTyres.$inferSelect[] = [];
      let tyreWarning: string | null = null;
      try {
        tyres = await loadTyres(db, id);
      } catch (error) {
        console.error("Tyre details are unavailable, continuing with vehicle profile", error);
        tyreWarning = "Tyre details are temporarily unavailable. Documents, maintenance and rental history are still available.";
      }

      return Response.json({
        ok: true,
        vehicle: {
          id: vehicle.id,
          name: vehicle.name,
          make: vehicle.make,
          registrationNumber: vehicle.registrationNumber,
          imageUrl: vehicle.imageUrl,
          fuelType: vehicle.fuelType,
          transmission: vehicle.transmission,
          modelYear: vehicle.modelYear,
          dailyRate: vehicle.dailyRate,
          odometerKm: vehicle.odometerKm,
          allowedKmPerDay: vehicle.allowedKmPerDay,
          extraKmRate: vehicle.extraKmRate,
          mileageKmPerLitre: vehicle.mileageKmPerLitre,
          status: vehicle.status,
          createdAt: vehicle.createdAt.toISOString(),
          updatedAt: vehicle.updatedAt.toISOString(),
        },
        documents: documents.map((item) => ({
          id: item.id,
          documentType: item.documentType,
          documentNumber: item.documentNumber,
          expiryDate: item.expiryDate,
          notes: item.notes,
          updatedAt: item.updatedAt.toISOString(),
        })),
        maintenance: maintenance.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          status: item.status,
          dueDate: item.dueDate,
          dueOdometerKm: item.dueOdometerKm,
          amount: item.amount,
          completedAt: item.completedAt?.toISOString() ?? null,
          createdAt: item.createdAt.toISOString(),
        })),
        tyres: tyres.map((item) => ({
          id: item.id,
          position: item.position,
          brand: item.brand,
          model: item.model,
          size: item.size,
          installedDate: item.installedDate,
          installedOdometerKm: item.installedOdometerKm,
          treadDepthMm: item.treadDepthMm,
          replacementDueDate: item.replacementDueDate,
          replacementDueOdometerKm: item.replacementDueOdometerKm,
          notes: item.notes,
          updatedAt: item.updatedAt.toISOString(),
        })),
        tyreWarning,
        rentals: rentalRows.map(({ booking, customer }) => ({
          id: booking.id,
          bookingNumber: booking.bookingNumber,
          customer: customer.name,
          phone: customer.phone,
          startAt: booking.startAt.toISOString(),
          endAt: booking.endAt.toISOString(),
          rentalDays: booking.rentalDays,
          dailyRate: booking.dailyRate,
          baseRentalAmount: booking.baseRentalAmount,
          otherCharges: booking.otherCharges,
          status: booking.status,
        })),
        expenses: expenseRows.map((item) => ({
          id: item.id,
          expenseNumber: item.expenseNumber,
          expenseDate: item.expenseDate,
          category: item.category,
          amount: item.amount,
          description: item.description,
          method: item.method,
        })),
      });
    });
  } catch (error) {
    if (error instanceof DatabaseConfigurationError) return Response.json({ ok: false, error: error.message }, { status: 503 });
    console.error("Could not load vehicle details", error);
    return Response.json({ ok: false, error: messageFor(error, "Could not load vehicle details.") }, { status: 500 });
  }
}

class VehicleUpdateError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
const updateText = (value: unknown, field: string) => {
  if (typeof value !== "string" || !value.trim()) throw new VehicleUpdateError(`${field} is required.`);
  return value.trim();
};
const updateWhole = (value: unknown, field: string, min = 0) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min) throw new VehicleUpdateError(`${field} must be ${min === 0 ? "0 or greater" : `at least ${min}`}.`);
  return n;
};
const updateNumber = (value: unknown, field: string, min = 0) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min) throw new VehicleUpdateError(`${field} must be ${min === 0 ? "0 or greater" : `at least ${min}`}.`);
  return Math.round(n * 100) / 100;
};
const manualVehicleStatus = (value: unknown) => {
  if (typeof value !== "string") throw new VehicleUpdateError("Vehicle status is invalid.");
  const normalized = value.trim().toLowerCase();
  if (normalized === "active") return "available";
  if (["available", "inactive", "maintenance"].includes(normalized)) return normalized;
  throw new VehicleUpdateError("Vehicle status can only be Active, Inactive or Maintenance.");
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const requestedStatus = body.status === undefined ? undefined : manualVehicleStatus(body.status);
    const values = {
      name: updateText(body.name, "Vehicle name"),
      make: updateText(body.make, "Make"),
      registrationNumber: updateText(body.registrationNumber, "Registration number").toUpperCase(),
      fuelType: updateText(body.fuelType, "Fuel type"),
      transmission: updateText(body.transmission, "Transmission"),
      modelYear: updateWhole(body.modelYear, "Model year", 1980),
      dailyRate: updateNumber(body.dailyRate, "Daily rate", 1),
      odometerKm: updateWhole(body.odometerKm, "Odometer"),
      allowedKmPerDay: updateWhole(body.allowedKmPerDay, "Allowed KM per day", 1),
      extraKmRate: updateNumber(body.extraKmRate, "Extra KM rate"),
      mileageKmPerLitre: updateNumber(body.mileageKmPerLitre, "Mileage", 0.1),
      updatedAt: new Date(),
    };

    const saved = await withRequestDb(async (db) => {
      const [current] = await db.select({ id: vehicles.id, status: vehicles.status }).from(vehicles).where(eq(vehicles.id, id)).limit(1);
      if (!current) return null;

      if (requestedStatus !== undefined) {
        const currentStatus = current.status.toLowerCase();
        if (["rented", "booked"].includes(currentStatus)) {
          throw new VehicleUpdateError("This vehicle is currently controlled by an active rental/booking. Its operational status cannot be changed manually.", 409);
        }
        if (!["available", "inactive", "maintenance"].includes(currentStatus)) {
          throw new VehicleUpdateError("This vehicle status is controlled automatically and cannot be changed manually.", 409);
        }
      }

      const [row] = await db.update(vehicles).set({
        ...values,
        ...(requestedStatus !== undefined ? { status: requestedStatus } : {}),
      }).where(eq(vehicles.id, id)).returning();
      return row;
    });
    if (!saved) return Response.json({ ok: false, error: "Vehicle not found." }, { status: 404 });
    return Response.json({ ok: true, vehicle: saved });
  } catch (error) {
    if (error instanceof VehicleUpdateError) return Response.json({ ok: false, error: error.message }, { status: error.status });
    if (error instanceof DatabaseConfigurationError) return Response.json({ ok: false, error: error.message }, { status: 503 });
    const code = postgresCode(error);
    if (code === "23505") return Response.json({ ok: false, error: "A vehicle with this registration number already exists." }, { status: 409 });
    console.error("Could not update vehicle", error);
    return Response.json({ ok: false, error: messageFor(error, "Could not update vehicle.") }, { status: 500 });
  }
}
