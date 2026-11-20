ALTER TABLE "discount" DROP CONSTRAINT "discount_code_unique";--> statement-breakpoint
ALTER TABLE "discount" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "discount" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "discount" ADD COLUMN "updated_by_id" text;--> statement-breakpoint
ALTER TABLE "discount" ADD CONSTRAINT "discount_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "discount_site_code_idx" ON "discount" USING btree ("site_id",upper("code"));--> statement-breakpoint
CREATE INDEX "discount_condition_discount_idx" ON "discount_condition" USING btree ("discount_id");--> statement-breakpoint
CREATE UNIQUE INDEX "discount_usage_order_idx" ON "discount_usage" USING btree ("discount_id","order_id");--> statement-breakpoint
CREATE INDEX "discount_usage_customer_idx" ON "discount_usage" USING btree ("discount_id","customer_id");