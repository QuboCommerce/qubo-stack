ALTER TABLE "product_image" ADD COLUMN "asset_id" uuid;--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "sha256" text;--> statement-breakpoint
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_image_product_idx" ON "product_image" USING btree ("product_id","position");--> statement-breakpoint
CREATE INDEX "product_image_asset_idx" ON "product_image" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "asset_org_sha256_idx" ON "asset" USING btree ("organization_id","sha256");--> statement-breakpoint
-- Link gallery rows that already point at a library file; legacy URLs stay unlinked until imported.
UPDATE "product_image" pi SET "asset_id" = a."id"
FROM "asset" a, "product" p, "site" s
WHERE p."id" = pi."product_id" AND s."id" = p."site_id" AND a."organization_id" = s."organization_id"
  AND a."id"::text = lower(substring(pi."url" from '/api/media/[0-9a-fA-F-]{36}/([0-9a-fA-F-]{36})\.'));--> statement-breakpoint
-- Product usage now comes from product_image.asset_id.
DELETE FROM "asset_usage" WHERE "owner_ref" LIKE 'product:%';
