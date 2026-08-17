import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const money = (name: string) => numeric(name, { precision: 12, scale: 2, mode: "number" });

export const vehicles = pgTable(
  "vehicles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 120 }).notNull(),
    make: varchar("make", { length: 120 }).notNull(),
    registrationNumber: varchar("registration_number", { length: 32 }).notNull(),
    imageUrl: text("image_url"),
    fuelType: varchar("fuel_type", { length: 32 }).notNull(),
    transmission: varchar("transmission", { length: 32 }).notNull(),
    modelYear: integer("model_year").notNull(),
    dailyRate: money("daily_rate").notNull(),
    odometerKm: integer("odometer_km").notNull().default(0),
    allowedKmPerDay: integer("allowed_km_per_day").notNull().default(100),
    extraKmRate: money("extra_km_rate").notNull().default(0),
    mileageKmPerLitre: numeric("mileage_km_per_litre", {
      precision: 6,
      scale: 2,
      mode: "number",
    })
      .notNull()
      .default(1),
    status: varchar("status", { length: 24 }).notNull().default("available"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("vehicles_registration_number_unique").on(table.registrationNumber),
    index("vehicles_status_idx").on(table.status),
  ],
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 32 }).notNull(),
    whatsappNumber: varchar("whatsapp_number", { length: 32 }),
    drivingLicence: varchar("driving_licence", { length: 64 }).notNull(),
    city: varchar("city", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("customers_phone_unique").on(table.phone)],
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingNumber: varchar("booking_number", { length: 32 }).notNull(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    rentalDays: integer("rental_days").notNull(),
    dailyRate: money("daily_rate").notNull(),
    baseRentalAmount: money("base_rental_amount").notNull(),
    bookingDiscount: money("booking_discount").notNull().default(0),
    otherCharges: money("other_charges").notNull().default(0),
    advancePaid: money("advance_paid").notNull().default(0),
    securityDeposit: money("security_deposit").notNull().default(0),
    startingKilometer: integer("starting_kilometer"),
    startingFuelRangeKm: integer("starting_fuel_range_km"),
    expectedReturnKilometer: integer("expected_return_kilometer"),
    status: varchar("status", { length: 24 }).notNull().default("booked"),
    handedOverAt: timestamp("handed_over_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("bookings_booking_number_unique").on(table.bookingNumber),
    index("bookings_vehicle_dates_idx").on(table.vehicleId, table.startAt, table.endAt),
    index("bookings_customer_idx").on(table.customerId),
    index("bookings_status_idx").on(table.status),
  ],
);

export const returnSettlements = pgTable(
  "return_settlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    actualReturnAt: timestamp("actual_return_at", { withTimezone: true }).notNull(),
    actualReturnKilometer: integer("actual_return_kilometer").notNull(),
    allowedKilometers: integer("allowed_kilometers").notNull(),
    expectedReturnKilometer: integer("expected_return_kilometer").notNull(),
    extraKilometers: integer("extra_kilometers").notNull().default(0),
    extraKmRate: money("extra_km_rate").notNull(),
    extraKmCharge: money("extra_km_charge").notNull().default(0),
    startingFuelRangeKm: integer("starting_fuel_range_km").notNull(),
    returnFuelRangeKm: integer("return_fuel_range_km").notNull(),
    fuelRangeShortageKm: integer("fuel_range_shortage_km").notNull().default(0),
    mileageKmPerLitre: numeric("mileage_km_per_litre", {
      precision: 6,
      scale: 2,
      mode: "number",
    }).notNull(),
    requiredFuelLitres: numeric("required_fuel_litres", {
      precision: 10,
      scale: 3,
      mode: "number",
    })
      .notNull()
      .default(0),
    fuelPricePerLitre: money("fuel_price_per_litre").notNull(),
    fuelCharge: money("fuel_charge").notNull().default(0),
    lateFee: money("late_fee").notNull().default(0),
    cleaningCharge: money("cleaning_charge").notNull().default(0),
    damageCharge: money("damage_charge").notNull().default(0),
    subtotal: money("subtotal").notNull(),
    discountAmount: money("discount_amount").notNull().default(0),
    discountRemark: text("discount_remark"),
    finalAmount: money("final_amount").notNull(),
    returnNotes: text("return_notes"),
    sendToMaintenance: boolean("send_to_maintenance").notNull().default(false),
    status: varchar("status", { length: 24 }).notNull().default("confirmed"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("return_settlements_booking_unique").on(table.bookingId)],
);

export type Vehicle = typeof vehicles.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type ReturnSettlement = typeof returnSettlements.$inferSelect;
