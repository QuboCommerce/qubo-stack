ALTER TABLE "site" ADD COLUMN "published_at" timestamp;--> statement-breakpoint
-- Sites that existed before drafts were introduced are live.
UPDATE "site" SET "published_at" = "created_at" WHERE "published_at" IS NULL;
