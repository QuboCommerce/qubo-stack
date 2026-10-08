CREATE TYPE "public"."inbox_file_source" AS ENUM('chat', 'email', 'form', 'staff');--> statement-breakpoint
CREATE TABLE "inbox_file" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"message_id" uuid,
	"key" text NOT NULL,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"source" "inbox_file_source" NOT NULL,
	"uploaded_by" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inbox_file" ADD CONSTRAINT "inbox_file_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_file" ADD CONSTRAINT "inbox_file_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_file" ADD CONSTRAINT "inbox_file_message_id_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_file" ADD CONSTRAINT "inbox_file_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inbox_file_conversation_idx" ON "inbox_file" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "inbox_file_message_idx" ON "inbox_file" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "inbox_file_expires_idx" ON "inbox_file" USING btree ("expires_at");