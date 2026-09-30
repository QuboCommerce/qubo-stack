-- Hand-written: rename the tenant entity "store" to "site" in place, keeping all
-- data. drizzle-kit would drop/recreate; this preserves rows and constraints.
CREATE TYPE "public"."site_type" AS ENUM('store', 'services', 'business', 'editorial', 'custom');--> statement-breakpoint
ALTER TABLE "store" RENAME TO "site";--> statement-breakpoint
ALTER TABLE "store_customer" RENAME TO "site_customer";--> statement-breakpoint
ALTER TABLE "store_domain" RENAME TO "site_domain";--> statement-breakpoint
ALTER TABLE "store_settings" RENAME TO "site_settings";--> statement-breakpoint
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT table_name FROM information_schema.columns
           WHERE table_schema = 'public' AND column_name = 'store_id'
  LOOP
    EXECUTE format('ALTER TABLE public.%I RENAME COLUMN store_id TO site_id', r.table_name);
  END LOOP;
  FOR r IN SELECT c.conrelid::regclass AS tbl, c.conname FROM pg_constraint c
           JOIN pg_namespace n ON n.oid = c.connamespace
           WHERE n.nspname = 'public' AND c.conname LIKE '%store%'
  LOOP
    EXECUTE format('ALTER TABLE %s RENAME CONSTRAINT %I TO %I', r.tbl, r.conname, replace(r.conname, 'store', 'site'));
  END LOOP;
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind = 'i' AND c.relname LIKE '%store%'
  LOOP
    EXECUTE format('ALTER INDEX public.%I RENAME TO %I', r.relname, replace(r.relname, 'store', 'site'));
  END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "site" ADD COLUMN "type" "site_type" DEFAULT 'store' NOT NULL;
