ALTER TYPE "public"."payment_method" ADD VALUE 'BANCONTACT' BEFORE 'BANK_TRANSFER';--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "customer_email" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "customer_name" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "shipping_address" jsonb;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "billing_address" jsonb;