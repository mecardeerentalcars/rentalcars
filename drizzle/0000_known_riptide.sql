CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_number" varchar(32) NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"rental_days" integer NOT NULL,
	"daily_rate" numeric(12, 2) NOT NULL,
	"base_rental_amount" numeric(12, 2) NOT NULL,
	"booking_discount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"other_charges" numeric(12, 2) DEFAULT 0 NOT NULL,
	"advance_paid" numeric(12, 2) DEFAULT 0 NOT NULL,
	"security_deposit" numeric(12, 2) DEFAULT 0 NOT NULL,
	"starting_kilometer" integer,
	"starting_fuel_range_km" integer,
	"expected_return_kilometer" integer,
	"status" varchar(24) DEFAULT 'booked' NOT NULL,
	"handed_over_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"phone" varchar(32) NOT NULL,
	"whatsapp_number" varchar(32),
	"driving_licence" varchar(64) NOT NULL,
	"city" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "return_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"actual_return_at" timestamp with time zone NOT NULL,
	"actual_return_kilometer" integer NOT NULL,
	"allowed_kilometers" integer NOT NULL,
	"expected_return_kilometer" integer NOT NULL,
	"extra_kilometers" integer DEFAULT 0 NOT NULL,
	"extra_km_rate" numeric(12, 2) NOT NULL,
	"extra_km_charge" numeric(12, 2) DEFAULT 0 NOT NULL,
	"starting_fuel_range_km" integer NOT NULL,
	"return_fuel_range_km" integer NOT NULL,
	"fuel_range_shortage_km" integer DEFAULT 0 NOT NULL,
	"mileage_km_per_litre" numeric(6, 2) NOT NULL,
	"required_fuel_litres" numeric(10, 3) DEFAULT 0 NOT NULL,
	"fuel_price_per_litre" numeric(12, 2) NOT NULL,
	"fuel_charge" numeric(12, 2) DEFAULT 0 NOT NULL,
	"late_fee" numeric(12, 2) DEFAULT 0 NOT NULL,
	"cleaning_charge" numeric(12, 2) DEFAULT 0 NOT NULL,
	"damage_charge" numeric(12, 2) DEFAULT 0 NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"discount_amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"discount_remark" text,
	"final_amount" numeric(12, 2) NOT NULL,
	"return_notes" text,
	"send_to_maintenance" boolean DEFAULT false NOT NULL,
	"status" varchar(24) DEFAULT 'confirmed' NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"make" varchar(120) NOT NULL,
	"registration_number" varchar(32) NOT NULL,
	"image_url" text,
	"fuel_type" varchar(32) NOT NULL,
	"transmission" varchar(32) NOT NULL,
	"model_year" integer NOT NULL,
	"daily_rate" numeric(12, 2) NOT NULL,
	"odometer_km" integer DEFAULT 0 NOT NULL,
	"allowed_km_per_day" integer DEFAULT 100 NOT NULL,
	"extra_km_rate" numeric(12, 2) DEFAULT 0 NOT NULL,
	"mileage_km_per_litre" numeric(6, 2) DEFAULT 1 NOT NULL,
	"status" varchar(24) DEFAULT 'available' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_settlements" ADD CONSTRAINT "return_settlements_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_booking_number_unique" ON "bookings" USING btree ("booking_number");--> statement-breakpoint
CREATE INDEX "bookings_vehicle_dates_idx" ON "bookings" USING btree ("vehicle_id","start_at","end_at");--> statement-breakpoint
CREATE INDEX "bookings_customer_idx" ON "bookings" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_phone_unique" ON "customers" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "return_settlements_booking_unique" ON "return_settlements" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_registration_number_unique" ON "vehicles" USING btree ("registration_number");--> statement-breakpoint
CREATE INDEX "vehicles_status_idx" ON "vehicles" USING btree ("status");