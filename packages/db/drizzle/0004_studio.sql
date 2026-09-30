CREATE TYPE "public"."site_capability" AS ENUM('commerce', 'catalog', 'booking', 'leads', 'blog', 'accounts', 'locales');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('template', 'page', 'section_group', 'linked_section');--> statement-breakpoint
CREATE TYPE "public"."font_source" AS ENUM('upload', 'google-selfhosted', 'system');--> statement-breakpoint
CREATE TYPE "public"."form_submission_status" AS ENUM('new', 'read', 'archived', 'spam');--> statement-breakpoint
CREATE TYPE "public"."resource_kind" AS ENUM('home', 'page', 'product', 'collection', 'collection_list', 'cart', 'search', 'service', 'booking', 'blog', 'article', 'account', 'not_found', 'password', 'maintenance');--> statement-breakpoint
CREATE TYPE "public"."revision_kind" AS ENUM('publish', 'checkpoint', 'autosave');--> statement-breakpoint
CREATE TYPE "public"."section_group_kind" AS ENUM('header', 'footer', 'overlay');--> statement-breakpoint
CREATE TYPE "public"."translation_status" AS ENUM('missing', 'draft', 'done', 'stale');--> statement-breakpoint
CREATE TABLE "asset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"site_id" uuid,
	"bucket" text DEFAULT 'media' NOT NULL,
	"key" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"duration" integer,
	"alt" text DEFAULT '' NOT NULL,
	"blurhash" text,
	"folder" text,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_tag" (
	"asset_id" uuid NOT NULL,
	"tag" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"document_id" uuid,
	"owner_ref" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_type_id" uuid NOT NULL,
	"handle" text NOT NULL,
	"values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"handle" text NOT NULL,
	"name" text NOT NULL,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_routable" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"kind" "document_kind" NOT NULL,
	"draft_data" jsonb NOT NULL,
	"draft_version" integer DEFAULT 1 NOT NULL,
	"published_data" jsonb,
	"published_revision_id" uuid,
	"published_at" timestamp,
	"updated_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_revision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"kind" "revision_kind" DEFAULT 'publish' NOT NULL,
	"data" jsonb NOT NULL,
	"label" text,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "font" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"family" text NOT NULL,
	"source" "font_source" DEFAULT 'upload' NOT NULL,
	"files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fallback" text DEFAULT 'system-ui, sans-serif' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"notify_emails" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_submission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"data" jsonb NOT NULL,
	"status" "form_submission_status" DEFAULT 'new' NOT NULL,
	"page_path" text,
	"locale" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "linked_section" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"name" text NOT NULL,
	"document_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "section_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"kind" "section_group_kind" NOT NULL,
	"document_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "section_preset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"block_type" text NOT NULL,
	"name" text NOT NULL,
	"props" jsonb NOT NULL,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_locale" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"resource_kind" "resource_kind" NOT NULL,
	"handle" text DEFAULT 'default' NOT NULL,
	"name" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"document_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "theme" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"draft" jsonb NOT NULL,
	"draft_version" integer DEFAULT 1 NOT NULL,
	"published" jsonb,
	"published_at" timestamp,
	"health" integer,
	"richness" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "theme_revision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"theme_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"data" jsonb NOT NULL,
	"label" text,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "translation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"owner_ref" text NOT NULL,
	"path" text NOT NULL,
	"locale" text NOT NULL,
	"value" text NOT NULL,
	"source_hash" text NOT NULL,
	"status" "translation_status" DEFAULT 'draft' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site" ADD COLUMN "capabilities" "site_capability"[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "page" ADD COLUMN "document_id" uuid;--> statement-breakpoint
ALTER TABLE "page" ADD COLUMN "template_handle" text;--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_tag" ADD CONSTRAINT "asset_tag_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_usage" ADD CONSTRAINT "asset_usage_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_usage" ADD CONSTRAINT "asset_usage_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_entry" ADD CONSTRAINT "content_entry_content_type_id_content_type_id_fk" FOREIGN KEY ("content_type_id") REFERENCES "public"."content_type"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_type" ADD CONSTRAINT "content_type_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_revision" ADD CONSTRAINT "document_revision_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_revision" ADD CONSTRAINT "document_revision_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "font" ADD CONSTRAINT "font_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form" ADD CONSTRAINT "form_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submission" ADD CONSTRAINT "form_submission_form_id_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."form"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linked_section" ADD CONSTRAINT "linked_section_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linked_section" ADD CONSTRAINT "linked_section_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_group" ADD CONSTRAINT "section_group_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_group" ADD CONSTRAINT "section_group_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_preset" ADD CONSTRAINT "section_preset_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_preset" ADD CONSTRAINT "section_preset_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_locale" ADD CONSTRAINT "site_locale_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template" ADD CONSTRAINT "template_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template" ADD CONSTRAINT "template_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme" ADD CONSTRAINT "theme_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_revision" ADD CONSTRAINT "theme_revision_theme_id_theme_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."theme"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_revision" ADD CONSTRAINT "theme_revision_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translation" ADD CONSTRAINT "translation_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "asset_bucket_key_idx" ON "asset" USING btree ("bucket","key");--> statement-breakpoint
CREATE INDEX "asset_org_site_idx" ON "asset" USING btree ("organization_id","site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "asset_tag_pk" ON "asset_tag" USING btree ("asset_id","tag");--> statement-breakpoint
CREATE INDEX "asset_tag_tag_idx" ON "asset_tag" USING btree ("tag");--> statement-breakpoint
CREATE INDEX "asset_usage_asset_idx" ON "asset_usage" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "asset_usage_document_idx" ON "asset_usage" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "content_entry_type_handle_idx" ON "content_entry" USING btree ("content_type_id","handle");--> statement-breakpoint
CREATE UNIQUE INDEX "content_type_site_handle_idx" ON "content_type" USING btree ("site_id","handle");--> statement-breakpoint
CREATE INDEX "document_site_kind_idx" ON "document" USING btree ("site_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "document_revision_doc_version_idx" ON "document_revision" USING btree ("document_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "font_org_family_idx" ON "font" USING btree ("organization_id","family");--> statement-breakpoint
CREATE UNIQUE INDEX "form_site_key_idx" ON "form" USING btree ("site_id","key");--> statement-breakpoint
CREATE INDEX "form_submission_form_created_idx" ON "form_submission" USING btree ("form_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "section_group_site_kind_idx" ON "section_group" USING btree ("site_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "site_locale_site_locale_idx" ON "site_locale" USING btree ("site_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "template_site_kind_handle_idx" ON "template" USING btree ("site_id","resource_kind","handle");--> statement-breakpoint
CREATE INDEX "theme_site_idx" ON "theme" USING btree ("site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "theme_revision_theme_version_idx" ON "theme_revision" USING btree ("theme_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "translation_owner_path_locale_idx" ON "translation" USING btree ("owner_ref","path","locale");--> statement-breakpoint
ALTER TABLE "page" ADD CONSTRAINT "page_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE set null ON UPDATE no action;