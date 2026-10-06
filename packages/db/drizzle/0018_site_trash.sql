ALTER TABLE "site" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "site" ADD COLUMN "deleted_by_id" text;--> statement-breakpoint
ALTER TABLE "site" ADD CONSTRAINT "site_deleted_by_id_user_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;