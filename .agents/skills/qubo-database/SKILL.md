---
name: qubo-database
description: Working with the Qubo Postgres database (Drizzle schema and migrations, psql access, pool rules, timestamp precision, compare-and-set). Use for any schema change, data fix or concurrency bug.
---

# Database

Supabase Postgres in dev (`supabase_db_react`, port 54322); plain Postgres 17 in prod compose.
Schema: `packages/db/schema/*.ts`, exported from `schema/index.ts`. Client: `@qubo/db/client`.

## Access

```sh
set -a; . ./.env; set +a; psql "$DATABASE_URL"
```

`psql -c` with several statements prints only the last result; use a heredoc or `-f`.

## Migrations

```sh
cd packages/db
npx drizzle-kit generate --name <slug>   # writes drizzle/NNNN_<slug>.sql
npx drizzle-kit migrate
```

Commit the SQL and the `meta/` snapshot together. Never edit an applied migration.

## Rules

- One pool per process: `packages/db/src/client.ts` caches it on `globalThis`
  (`DATABASE_POOL_MAX`, `idle_timeout` 30). Never call `postgres()` elsewhere.
- `timestamp` columns have microsecond precision; JS `Date` has milliseconds. Any
  compare-and-set on a timestamp must truncate:
  `date_trunc('milliseconds', col) = $iso::timestamp` (see `unchangedSince` in
  `apps/qubo-admin/lib/merge-server.ts`).
- Multi-user writes go through `reconcile()` (three-way merge) plus CAS on `updatedAt`.
- Tables are singular snake_case; ids are `uuid` with `gen_random_uuid()`; every row that a
  user can edit has `created_at`, `updated_at`, `updated_by_id`.
- Site-scoped tables carry `site_id`; every query must filter by it. Check membership with
  `viewerOf` + `siteIds` in the admin, `SiteContext` in the API.

## Useful ids (dev data)

hm-froid site `2d422b67-306e-4ac7-9f62-02e57f06eb10`; organization
`cae6c108-8852-4afc-9422-e0b46b053dda`; admin user `n4PXAdUtCzGkYHjS3Sj3Bm0kAZKqakyX`.
