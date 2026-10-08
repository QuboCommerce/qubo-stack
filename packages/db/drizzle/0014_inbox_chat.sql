ALTER TABLE "conversation" ADD COLUMN "visitor_token_hash" text;--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "visitor_seen_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_visitor_token_idx" ON "conversation" USING btree ("site_id","visitor_token_hash");--> statement-breakpoint
CREATE INDEX "conversation_customer_idx" ON "conversation" USING btree ("site_id","customer_id");