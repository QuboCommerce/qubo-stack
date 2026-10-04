CREATE TABLE "studio_lease" (
	"resource" text PRIMARY KEY NOT NULL,
	"site_id" uuid NOT NULL,
	"client_id" text NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text NOT NULL,
	"acquired_at" timestamp with time zone DEFAULT now() NOT NULL,
	"active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "studio_lease_site_idx" ON "studio_lease" USING btree ("site_id");