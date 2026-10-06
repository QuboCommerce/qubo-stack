ALTER TABLE "site_settings" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "business_type" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "opening_hours" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "latitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "longitude" numeric(9, 6);