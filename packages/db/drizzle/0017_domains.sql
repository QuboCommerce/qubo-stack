ALTER TABLE "site_domain" ADD COLUMN "verify_token" text;--> statement-breakpoint
ALTER TABLE "site_domain" ADD COLUMN "share_token" text;--> statement-breakpoint
UPDATE "site_domain" SET "verify_token" = replace(gen_random_uuid()::text, '-', ''), "share_token" = replace(gen_random_uuid()::text, '-', '');--> statement-breakpoint
ALTER TABLE "site_domain" ALTER COLUMN "verify_token" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "site_domain" ALTER COLUMN "share_token" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "site_domain" ALTER COLUMN "verify_token" SET DEFAULT replace(gen_random_uuid()::text, '-', '');--> statement-breakpoint
ALTER TABLE "site_domain" ALTER COLUMN "share_token" SET DEFAULT replace(gen_random_uuid()::text, '-', '');--> statement-breakpoint
ALTER TABLE "site_domain" ADD COLUMN "dns" jsonb;--> statement-breakpoint
ALTER TABLE "site_domain" ADD COLUMN "checked_at" timestamp;--> statement-breakpoint
ALTER TABLE "site_domain" ADD COLUMN "next_check_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "site_domain" ADD CONSTRAINT "site_domain_share_token_unique" UNIQUE("share_token");
