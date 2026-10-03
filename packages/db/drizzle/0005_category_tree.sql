ALTER TABLE "product_category" ADD CONSTRAINT "product_category_product_id_category_id_pk" PRIMARY KEY("product_id","category_id");--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "category_site_parent_idx" ON "category" USING btree ("site_id","parent_id","position");--> statement-breakpoint
CREATE INDEX "product_category_category_idx" ON "product_category" USING btree ("category_id");