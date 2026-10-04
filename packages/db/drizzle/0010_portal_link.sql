CREATE TABLE "portal_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portal_url" text NOT NULL,
	"instance_id" text NOT NULL,
	"portal_organization_id" text NOT NULL,
	"jwks_url" text NOT NULL,
	"public_key_jwk" jsonb NOT NULL,
	"private_key_jwk" jsonb NOT NULL,
	"license_token" text,
	"license_claims" jsonb,
	"license_fetched_at" timestamp,
	"last_heartbeat_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
