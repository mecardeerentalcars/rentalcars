CREATE TABLE IF NOT EXISTS "backup_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"trigger_type" varchar(32) NOT NULL,
	"destination" varchar(32) NOT NULL,
	"status" varchar(24) NOT NULL,
	"filename" varchar(220) NOT NULL,
	"file_size" integer,
	"google_drive_file_id" varchar(180),
	"error_message" text,
	"cleanup_warning" text,
	"created_by" varchar(120) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "google_backup_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_email" varchar(320) NOT NULL,
	"refresh_token_encrypted" text NOT NULL,
	"folder_id" varchar(180) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"reconnect_required" boolean DEFAULT false NOT NULL,
	"connected_by" varchar(120) NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "backup_history_created_at_idx" ON "backup_history" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "google_backup_connections_active_idx" ON "google_backup_connections" USING btree ("active");
