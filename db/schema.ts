// MECARDEE_RENTAL_EXPENSES_PAYMENTS_HUB_V8_9_81
// MECARDEE_GUEST_OWNER_FIELDS_V8_9_79
// MECARDEE_USER_ROLES_V8_9_55
// MECARDEE_SEGMENT_FUEL_FINAL_SETTLEMENT_V8_9_45
import {
  boolean,
  date,
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
    isGuest: boolean("is_guest").notNull().default(false),
    guestOwnerName: varchar("guest_owner_name", { length: 160 }),
    guestOwnerPlace: varchar("guest_owner_place", { length: 120 }),
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
    requestedVehicleId: uuid("requested_vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "restrict" }),
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
    index("bookings_requested_vehicle_idx").on(table.requestedVehicleId),
    index("bookings_vehicle_dates_idx").on(table.vehicleId, table.startAt, table.endAt),
    index("bookings_customer_idx").on(table.customerId),
    index("bookings_status_idx").on(table.status),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentNumber: varchar("payment_number", { length: 40 }).notNull(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    amount: money("amount").notNull(),
    method: varchar("method", { length: 40 }).notNull(),
    paymentType: varchar("payment_type", { length: 32 }).notNull().default("rental"),
    notes: text("notes"),
    receivedBy: varchar("received_by", { length: 120 }).notNull().default("Ajmal"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("payments_payment_number_unique").on(table.paymentNumber),
    index("payments_booking_idx").on(table.bookingId),
    index("payments_customer_idx").on(table.customerId),
    index("payments_received_at_idx").on(table.receivedAt),
  ],
);

export const rentalExtensions = pgTable(
  "rental_extensions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    previousEndAt: timestamp("previous_end_at", { withTimezone: true }).notNull(),
    newEndAt: timestamp("new_end_at", { withTimezone: true }).notNull(),
    additionalDays: integer("additional_days").notNull(),
    dailyRate: money("daily_rate").notNull(),
    addedAmount: money("added_amount").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("rental_extensions_booking_idx").on(table.bookingId)],
);

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expenseNumber: varchar("expense_number", { length: 40 }).notNull(),
    expenseDate: date("expense_date", { mode: "string" }).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    amount: money("amount").notNull(),
    description: text("description"),
    method: varchar("method", { length: 40 }).notNull(),
    createdBy: varchar("created_by", { length: 120 }).notNull().default("Ajmal"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("expenses_expense_number_unique").on(table.expenseNumber),
    index("expenses_expense_date_idx").on(table.expenseDate),
    index("expenses_vehicle_idx").on(table.vehicleId),
    index("expenses_booking_idx").on(table.bookingId),
  ],
);

export const vehicleDocuments = pgTable(
  "vehicle_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    documentType: varchar("document_type", { length: 80 }).notNull(),
    documentNumber: varchar("document_number", { length: 120 }),
    expiryDate: date("expiry_date", { mode: "string" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("vehicle_documents_vehicle_type_unique").on(table.vehicleId, table.documentType),
    index("vehicle_documents_expiry_idx").on(table.expiryDate),
  ],
);

export const maintenanceRecords = pgTable(
  "maintenance_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 24 }).notNull().default("open"),
    dueDate: date("due_date", { mode: "string" }),
    dueOdometerKm: integer("due_odometer_km"),
    amount: money("amount").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("maintenance_records_vehicle_idx").on(table.vehicleId),
    index("maintenance_records_status_idx").on(table.status),
  ],
);


export const vehicleTyres = pgTable(
  "vehicle_tyres",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    position: varchar("position", { length: 32 }).notNull(),
    brand: varchar("brand", { length: 120 }),
    model: varchar("model", { length: 120 }),
    size: varchar("size", { length: 64 }),
    installedDate: date("installed_date", { mode: "string" }),
    installedOdometerKm: integer("installed_odometer_km"),
    treadDepthMm: numeric("tread_depth_mm", { precision: 5, scale: 2, mode: "number" }),
    replacementDueDate: date("replacement_due_date", { mode: "string" }),
    replacementDueOdometerKm: integer("replacement_due_odometer_km"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("vehicle_tyres_vehicle_position_unique").on(table.vehicleId, table.position),
    index("vehicle_tyres_vehicle_idx").on(table.vehicleId),
  ],
);

export const rentalSegments = pgTable(
  "rental_segments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    sequence: integer("sequence").notNull(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "restrict" }),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }),
    startingKilometer: integer("starting_kilometer").notNull(),
    endingKilometer: integer("ending_kilometer"),
    startingFuelRangeKm: integer("starting_fuel_range_km").notNull().default(0),
    returnFuelRangeKm: integer("return_fuel_range_km"),
    fuelRangeShortageKm: integer("fuel_range_shortage_km").notNull().default(0),
    fuelPricePerLitre: money("fuel_price_per_litre").notNull().default(105),
    fuelCharge: money("fuel_charge").notNull().default(0),
    dailyRate: money("daily_rate").notNull(),
    rentalDays: integer("rental_days").notNull().default(1),
    rentalCharge: money("rental_charge").notNull().default(0),
    allowedKmPerDay: integer("allowed_km_per_day").notNull().default(100),
    extraKmRate: money("extra_km_rate").notNull().default(0),
    extraKilometers: integer("extra_kilometers").notNull().default(0),
    extraKmCharge: money("extra_km_charge").notNull().default(0),
    status: varchar("status", { length: 24 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("rental_segments_booking_sequence_unique").on(table.bookingId, table.sequence),
    index("rental_segments_booking_idx").on(table.bookingId),
    index("rental_segments_vehicle_idx").on(table.vehicleId),
    index("rental_segments_status_idx").on(table.status),
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
    vehicleCondition: varchar("vehicle_condition", { length: 80 }),
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

export const appUsers = pgTable(
  "app_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    username: varchar("username", { length: 80 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: varchar("role", { length: 24 }).notNull().default("viewer"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("app_users_username_unique").on(table.username),
    index("app_users_role_idx").on(table.role),
  ],
);

export const appUserSessions = pgTable(
  "app_user_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => appUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("app_user_sessions_token_unique").on(table.tokenHash),
    index("app_user_sessions_user_idx").on(table.userId),
    index("app_user_sessions_expiry_idx").on(table.expiresAt),
  ],
);

export const googleBackupConnections = pgTable(
  "google_backup_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountEmail: varchar("account_email", { length: 320 }).notNull(),
    refreshTokenEncrypted: text("refresh_token_encrypted").notNull(),
    folderId: varchar("folder_id", { length: 180 }).notNull(),
    active: boolean("active").notNull().default(true),
    reconnectRequired: boolean("reconnect_required").notNull().default(false),
    connectedBy: varchar("connected_by", { length: 120 }).notNull(),
    connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("google_backup_connections_active_idx").on(table.active)],
);

export const backupHistory = pgTable(
  "backup_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    triggerType: varchar("trigger_type", { length: 32 }).notNull(),
    destination: varchar("destination", { length: 32 }).notNull(),
    status: varchar("status", { length: 24 }).notNull(),
    filename: varchar("filename", { length: 220 }).notNull(),
    fileSize: integer("file_size"),
    googleDriveFileId: varchar("google_drive_file_id", { length: 180 }),
    errorMessage: text("error_message"),
    cleanupWarning: text("cleanup_warning"),
    createdBy: varchar("created_by", { length: 120 }).notNull(),
  },
  (table) => [index("backup_history_created_at_idx").on(table.createdAt)],
);

export type AppUser = typeof appUsers.$inferSelect;
export type AppUserSession = typeof appUserSessions.$inferSelect;
export type GoogleBackupConnection = typeof googleBackupConnections.$inferSelect;
export type BackupHistory = typeof backupHistory.$inferSelect;

export type Vehicle = typeof vehicles.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type RentalExtension = typeof rentalExtensions.$inferSelect;
export type ReturnSettlement = typeof returnSettlements.$inferSelect;
export type RentalSegment = typeof rentalSegments.$inferSelect;
