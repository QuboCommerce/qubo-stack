ALTER TABLE "conversation" ADD COLUMN "ticket_number" integer;--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "escalated_at" timestamp;--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "participants" jsonb DEFAULT '{"cc":[],"bcc":[]}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "message" ADD COLUMN "recipients" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_ticket_number_idx" ON "conversation" USING btree ("site_id","ticket_number");