-- Mecardee Rental Manager - complete PostgreSQL schema + safe live upgrade
-- Idempotent: safe to run repeatedly. Existing rows are preserved.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  make varchar(120) NOT NULL,
  registration_number varchar(32) NOT NULL,
  image_url text,
  fuel_type varchar(32) NOT NULL,
  transmission varchar(32) NOT NULL,
  model_year integer NOT NULL,
  daily_rate numeric(12,2) NOT NULL,
  odometer_km integer NOT NULL DEFAULT 0,
  allowed_km_per_day integer NOT NULL DEFAULT 100,
  extra_km_rate numeric(12,2) NOT NULL DEFAULT 0,
  mileage_km_per_litre numeric(6,2) NOT NULL DEFAULT 1,
  status varchar(24) NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(160) NOT NULL,
  phone varchar(32) NOT NULL,
  whatsapp_number varchar(32),
  driving_licence varchar(64) NOT NULL,
  city varchar(100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number varchar(32) NOT NULL,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  rental_days integer NOT NULL,
  daily_rate numeric(12,2) NOT NULL,
  base_rental_amount numeric(12,2) NOT NULL,
  booking_discount numeric(12,2) NOT NULL DEFAULT 0,
  other_charges numeric(12,2) NOT NULL DEFAULT 0,
  advance_paid numeric(12,2) NOT NULL DEFAULT 0,
  security_deposit numeric(12,2) NOT NULL DEFAULT 0,
  starting_kilometer integer,
  starting_fuel_range_km integer,
  expected_return_kilometer integer,
  status varchar(24) NOT NULL DEFAULT 'booked',
  handed_over_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS return_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  actual_return_at timestamptz NOT NULL,
  actual_return_kilometer integer NOT NULL,
  allowed_kilometers integer NOT NULL,
  expected_return_kilometer integer NOT NULL,
  extra_kilometers integer NOT NULL DEFAULT 0,
  extra_km_rate numeric(12,2) NOT NULL,
  extra_km_charge numeric(12,2) NOT NULL DEFAULT 0,
  starting_fuel_range_km integer NOT NULL,
  return_fuel_range_km integer NOT NULL,
  fuel_range_shortage_km integer NOT NULL DEFAULT 0,
  mileage_km_per_litre numeric(6,2) NOT NULL,
  required_fuel_litres numeric(10,3) NOT NULL DEFAULT 0,
  fuel_price_per_litre numeric(12,2) NOT NULL,
  fuel_charge numeric(12,2) NOT NULL DEFAULT 0,
  late_fee numeric(12,2) NOT NULL DEFAULT 0,
  cleaning_charge numeric(12,2) NOT NULL DEFAULT 0,
  damage_charge numeric(12,2) NOT NULL DEFAULT 0,
  vehicle_condition varchar(80),
  subtotal numeric(12,2) NOT NULL,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  discount_remark text,
  final_amount numeric(12,2) NOT NULL,
  return_notes text,
  send_to_maintenance boolean NOT NULL DEFAULT false,
  status varchar(24) NOT NULL DEFAULT 'confirmed',
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Upgrade the original settlement table without dropping/recreating it.
ALTER TABLE return_settlements ADD COLUMN IF NOT EXISTS vehicle_condition varchar(80);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number varchar(40) NOT NULL,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL,
  method varchar(40) NOT NULL,
  payment_type varchar(32) NOT NULL DEFAULT 'rental',
  notes text,
  received_by varchar(120) NOT NULL DEFAULT 'Ajmal',
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_amount_positive CHECK (amount > 0)
);

CREATE TABLE IF NOT EXISTS rental_extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  previous_end_at timestamptz NOT NULL,
  new_end_at timestamptz NOT NULL,
  additional_days integer NOT NULL,
  daily_rate numeric(12,2) NOT NULL,
  added_amount numeric(12,2) NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rental_extensions_days_positive CHECK (additional_days > 0)
);

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_number varchar(40) NOT NULL,
  expense_date date NOT NULL,
  category varchar(80) NOT NULL,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL,
  description text,
  method varchar(40) NOT NULL,
  created_by varchar(120) NOT NULL DEFAULT 'Ajmal',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expenses_amount_positive CHECK (amount > 0)
);

CREATE TABLE IF NOT EXISTS vehicle_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  document_type varchar(80) NOT NULL,
  document_number varchar(120),
  expiry_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maintenance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  title varchar(160) NOT NULL,
  description text,
  status varchar(24) NOT NULL DEFAULT 'open',
  due_date date,
  due_odometer_km integer,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


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
);

-- Core uniqueness/indexes. IF NOT EXISTS keeps repeated deploys safe.
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_registration_number_unique ON vehicles(registration_number);
CREATE INDEX IF NOT EXISTS vehicles_status_idx ON vehicles(status);
CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_unique ON customers(phone);
CREATE UNIQUE INDEX IF NOT EXISTS bookings_booking_number_unique ON bookings(booking_number);
CREATE INDEX IF NOT EXISTS bookings_vehicle_dates_idx ON bookings(vehicle_id, start_at, end_at);
CREATE INDEX IF NOT EXISTS bookings_customer_idx ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings(status);
CREATE UNIQUE INDEX IF NOT EXISTS return_settlements_booking_unique ON return_settlements(booking_id);
CREATE UNIQUE INDEX IF NOT EXISTS payments_payment_number_unique ON payments(payment_number);
CREATE INDEX IF NOT EXISTS payments_booking_idx ON payments(booking_id);
CREATE INDEX IF NOT EXISTS payments_customer_idx ON payments(customer_id);
CREATE INDEX IF NOT EXISTS payments_received_at_idx ON payments(received_at);
CREATE INDEX IF NOT EXISTS rental_extensions_booking_idx ON rental_extensions(booking_id);
CREATE UNIQUE INDEX IF NOT EXISTS expenses_expense_number_unique ON expenses(expense_number);
CREATE INDEX IF NOT EXISTS expenses_expense_date_idx ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS expenses_vehicle_idx ON expenses(vehicle_id);
CREATE UNIQUE INDEX IF NOT EXISTS vehicle_documents_vehicle_type_unique ON vehicle_documents(vehicle_id, document_type);
CREATE INDEX IF NOT EXISTS vehicle_documents_expiry_idx ON vehicle_documents(expiry_date);
CREATE INDEX IF NOT EXISTS maintenance_records_vehicle_idx ON maintenance_records(vehicle_id);
CREATE INDEX IF NOT EXISTS maintenance_records_status_idx ON maintenance_records(status);
CREATE UNIQUE INDEX IF NOT EXISTS vehicle_tyres_vehicle_position_unique ON vehicle_tyres(vehicle_id, position);
CREATE INDEX IF NOT EXISTS vehicle_tyres_vehicle_idx ON vehicle_tyres(vehicle_id);

-- Backfill the legacy bookings.advance_paid values into the new payment ledger.
-- This prevents existing rentals from losing their already-paid balance after upgrade.
INSERT INTO payments (
  payment_number,
  booking_id,
  customer_id,
  amount,
  method,
  payment_type,
  notes,
  received_by,
  received_at
)
SELECT
  'PAY-BACKFILL-' || upper(substr(replace(b.id::text, '-', ''), 1, 12)),
  b.id,
  b.customer_id,
  b.advance_paid,
  'Legacy / unknown',
  'advance',
  'Backfilled from bookings.advance_paid during live database upgrade',
  'Migration',
  COALESCE(b.handed_over_at, b.start_at, b.created_at)
FROM bookings b
WHERE b.advance_paid > 0
  AND b.status <> 'draft'
  AND NOT EXISTS (
    SELECT 1
    FROM payments p
    WHERE p.booking_id = b.id
      AND p.payment_type = 'advance'
  )
ON CONFLICT (payment_number) DO NOTHING;

COMMIT;
