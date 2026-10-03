CREATE TABLE "session_device" (
	"session_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"device_label" text NOT NULL,
	"browser" text,
	"os" text,
	"ip" text,
	"city" text,
	"region" text,
	"country" text,
	"country_code" text,
	"lat" double precision,
	"lng" double precision,
	"is_local" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_focused_at" timestamp with time zone,
	"is_focused" boolean DEFAULT false NOT NULL,
	"ended_at" timestamp with time zone,
	"revoked_reason" text,
	"ended_by_session_id" text,
	CONSTRAINT "session_device_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE INDEX "session_device_user_idx" ON "session_device" USING btree ("user_id","last_active_at");