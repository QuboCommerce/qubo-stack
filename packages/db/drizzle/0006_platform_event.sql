CREATE TABLE "platform_event" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"site_id" text,
	"org_id" text,
	"user_id" text,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "platform_event_site_idx" ON "platform_event" USING btree ("site_id","id");--> statement-breakpoint
CREATE INDEX "platform_event_created_idx" ON "platform_event" USING btree ("created_at");