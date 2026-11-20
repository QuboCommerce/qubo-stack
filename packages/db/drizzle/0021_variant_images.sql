CREATE TABLE "product_variant_image" (
	"variant_id" uuid NOT NULL,
	"product_image_id" uuid NOT NULL,
	CONSTRAINT "product_variant_image_variant_id_product_image_id_pk" PRIMARY KEY("variant_id","product_image_id")
);
--> statement-breakpoint
ALTER TABLE "product_variant_image" ADD CONSTRAINT "product_variant_image_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_image" ADD CONSTRAINT "product_variant_image_product_image_id_product_image_id_fk" FOREIGN KEY ("product_image_id") REFERENCES "public"."product_image"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_variant_image_image_idx" ON "product_variant_image" USING btree ("product_image_id");