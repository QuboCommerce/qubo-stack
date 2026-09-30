# Peltier Stack — Handoff

> Entry point for any new chat session. Read this before making changes.
> Last verified: 2026-09-30.

## What this is

**Peltier Stack** is a self-hosted, multi-site business platform built for
Mostapha Hilal (aka Wooster), who runs two businesses:

| Business | What it sells | Status |
| --- | --- | --- |
| **HM Froid** | Industrial/commercial refrigeration (since 2008) | Migrating off ShopApplication — **urgent** |
| **TailG Belgium** | Electric scooters | Still on Odoo, **not yet migrated** |

One control plane (`peltier-admin`) manages many **Sites**, Shopify-style
site switching, but fully owned. A Site has a **type** (`store`, `services`,
`business`, `editorial`, `custom`) — the preset it was created from; both
HM Froid and TailG are `store` sites. A fridge and an e-scooter are ~98% the same
product shape, so a single catalog/variant/pricing model serves both.

- **Repository:** https://github.com/aliaddas/peltier-stack (push via SSH)
- **Live legacy site being replaced:** hmfroid.be

## Architecture

```
peltier-stack/                     Turborepo + pnpm workspace
├── apps/
│   ├── peltier-admin/             Next.js 16 control plane (:4000)
│   ├── hm-froid/                  Next.js 16 storefront (:3000)
│   └── (tailg-belgium/)           future second storefront
├── packages/
│   ├── api/        @peltier/api   peltier-elysia: Elysia on Bun, auth + tenancy (:3333)
│   ├── db/         @peltier/db    Drizzle schema + client (PostgreSQL)
│   ├── shared/     @peltier/shared Zod validators, utils, constants
│   ├── stylekit/   @peltier/stylekit themes: palette → schemes → CSS vars, Palette Doctor
│   ├── blocks/     @peltier/blocks  schema-first Puck block library + render/editor configs
│   └── storefront/ @peltier/storefront typed client for storefronts → API
├── caddy/Caddyfile
├── scripts/                       legacy archive + importer + link-env
├── .zed/                          settings.json + tasks.json
└── docker-compose.yml
```

### Docker topology

| Service | Container | Port |
| --- | --- | --- |
| Database (dev) | shared Supabase CLI stack `react`, database `peltier` | 127.0.0.1:54322 |
| Database (legacy, retiring) | `peltier-postgres` | 127.0.0.1:55433 → 5432 |
| API | `peltier-elysia` | 3333 |
| Control plane | `peltier-admin` | 4000 |
| Storefront | `hm-froid` | 3000 |
| Edge proxy | `caddy-edge` | 80/443 |

Network: `peltier-network`. Compose project name: `peltier`.

### Database: Supabase (since 2026-09-30)

Dev runs on the machine-wide Supabase CLI stack (`supabase_*_react`), in its
**own database** `peltier`, owned by a login role `peltier`. Isolation comes
from Postgres itself: `CONNECT` on the database is revoked from `PUBLIC`, so
Supabase's API roles (`anon`, `authenticated`, `service_role`) and PostgREST
cannot reach it — PostgREST only serves the `postgres` database. Drizzle owns
`public` inside `peltier`; nothing else writes there.

Production gets its own VPS with a dedicated self-hosted Supabase; the same
database-per-project layout applies. `peltier-postgres` stays in compose until
that cutover. Storage (A9) will use Supabase Storage buckets; the local stack
has S3 protocol and image transformation disabled, so dev serves plain object
URLs.

## Running locally

```bash
cp .env.example .env          # then fill values
pnpm install                  # postinstall links root .env into each app
# Database: the shared Supabase stack must be running (`docker ps | grep supabase_db_react`)
pnpm dev                      # admin :4000, storefront :3000
```

In Zed, use the command palette → `task: spawn` for dev/build/db/docker tasks.

### Env loading — important

Next only reads `.env` from its own app directory, and `@next/env` resets
`process.env` to a cached `initialEnv`, which silently wipes anything loaded
from `next.config.ts`. So `scripts/link-env.mjs` symlinks the root `.env` into
each app on `postinstall`. If env vars go missing, run `pnpm setup:env`.

`@peltier/db` throws on a missing `DATABASE_URL` rather than silently
connecting as the OS user.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, RSC, Server Actions) |
| Package manager | pnpm 10 (workspace protocol) |
| Monorepo | Turborepo |
| ORM | Drizzle + postgres-js |
| Database | PostgreSQL 17 |
| Auth | Better Auth (self-hosted) |
| Server state | TanStack Query v5 |
| Forms | TanStack Form + Zod 4 (Standard Schema, no adapter) |
| UI | Tailwind v4 + shadcn/ui (new-york) |
| Payments | Stripe (cards, Bancontact, Apple Pay) |
| Proxy | Caddy 2 |

## Database

~48 tables in `packages/db/schema/`, including `organization`,
`organizationMember`, `site`, `siteDomain`, `siteSettings` (multi-tenancy), `customerGroup`
and `priceList` (B2B reseller pricing), and `legacySystem`/`legacyId`
provenance columns so imports stay idempotent.

**Variant model:** `ProductOption` (dimension, e.g. "Capacity") →
`ProductOptionValue` ("400L") → `ProductVariant` (the sellable SKU, with its
own price/stock/barcode). `product.basePrice` is the default; a variant
`price` is a nullable override.

### Current data (restored and verified)

| Table | Rows |
| --- | --- |
| product | 3949 |
| product_variant | 3949 |
| product_image | 3946 |
| site_customer | 2263 |
| price_list / customer_group | 2 / 2 |
| **category / product_category** | **0 — see gaps** |
| order | 0 (history intentionally not migrated) |

## Known gaps — read before planning work

1. **No category tree.** `category` and `product_category` are empty. This is
   *not* an importer bug: the ShopApplication export
   (`docs/reference-material/hmfroid-full-productlist.txt`) has no category
   column at all — only reference, name, VAT, two prices, image, stock, colour.
   The tree **is recoverable**: `.private/legacy-archive/2026-09-18/admin/
   admin_articles_rubriques.php.html` holds 648 hierarchical entries
   (`FROID COMMERCIAL` → `Armoires réfrigérées négatives`, `CHAMBRES FROIDES` →
   `Monobloc positif`, …). Mostapha's whole business is fine-grained
   subcategories, so this is high priority.
2. **216 products missing.** 3949 of 4165 imported; 1172 duplicates collapsed,
   30 invalid. Admin reported 3174 active + 991 inactive.
3. **No product descriptions or brands** in the source export.
4. **`peltier-admin` has a real shell but little CRUD yet.** Site-scoped routes
   (`/[site]/…`), capability-driven sidebar, ⌘K palette, dashboard, paged
   products/customers, orders, themes and settings hub. Still missing: product
   editor, variant builder, media manager, the Studio editor itself. Unbuilt
   sections render a "roadmap" placeholder via `app/[site]/[...rest]`.
5. **Legacy admin password was shared in chat** — rotate it.

## Key decisions

1. **Next.js over TanStack Start** — TanStack Router/Start is incompatible with
   the App Router. Query + Form are used as add-ons.
2. **Drizzle over Prisma** — lighter, no generate step, better Docker cold
   starts. (Prisma was briefly considered and rejected.)
3. **Better Auth over Clerk** — self-hosted, no per-user cost, owns the data.
4. **Stripe, not a payment CMS** — Stripe holds card data; we own catalogue,
   customers, orders, content.
5. **No Shopify** — ShopApplication's repricing is exactly the dependency risk
   being escaped. Same argument applies to any hosted CMS.
6. **Odoo is being dropped entirely** for TailG — too complex for the need.
7. **Puck (MIT) for page building** — persist versioned block JSON, never
   generated React source. AI should emit validated block trees from approved
   component schemas; executing merchant-authored React in the panel is a
   security and deployment hazard.
8. **`peltier-elysia` owns tenancy** — three consumers (admin + two
   storefronts) share tenancy and pricing rules. The acting site comes from the
   `x-peltier-site` header (admin switcher) or the request hostname
   (`site_domain`). If storefronts keep direct DB
   access "just for reads", the API becomes decorative and you get two sources
   of truth.

9. **Studio blocks are schema-first and self-styled** — every block is declared
   once with `f.*` fields (Zod schema, Puck field, JSON Schema for AI,
   translations, blueprint tokens all derive from it). Blocks ship their own CSS
   (`blockCss`, emitted by `ThemeStyles`) driven by StyleKit CSS variables, so
   a document renders identically in the Studio iframe and any storefront
   without depending on the host app's Tailwind. Defaults are filled at render
   time, so sparse/AI-written props never crash. Render proof:
   `apps/hm-froid/app/studio-proof` (noindex).
10. **StyleKit roles are semantic** — `accent` is a fill (paired with
   `onAccent`); `accentText` is accent used as text (eyebrows, highlights) and
   falls back to `link`. Schemes reference palette tokens only.
11. **Admin URLs are site-scoped** — `/{siteSlug}/products` etc. Layout calls
   `requireSite(slug)` (membership check → 404). Server actions receive the
   slug via a hidden `site` input and call `requireSiteFromForm`. Navigation is
   derived from `site.capabilities` (`lib/navigation.ts`), so a services site
   never sees Orders/Products. Pages use `<Page width>` tiers and
   `@container` queries; breakpoints go up to `5xl` (3440px ultrawide).

## Roadmap

- [x] Rename/restructure to `peltier-stack`, push to GitHub
- [x] Zed workspace (`.zed/settings.json`, `.zed/tasks.json`)
- [x] `packages/api` — Elysia on Bun, auth + tenancy middleware
- [x] Multi-storefront seams (`@peltier/storefront`)
- [x] Puck install + `page`/`pageRevision` schema in `peltier-admin`
- [x] Rename `store` → `site` (+ `site.type`), move DB onto Supabase
- [ ] Peltier Studio — Plan A foundation (packages/stylekit, packages/blocks, documents, media)
- [ ] Peltier Studio — Plan B native Studio UI
- [ ] Rebuild category tree, recover missing products
- [ ] Panel CRUD: products, variants, media, orders
- [ ] Comparison pass against `../../Karima/kyf-moves` (1-year-old panel)
- [ ] Domain/DNS cutover from ShopApplication

## Conventions

- Imports: `@/*` is the app root; shared code via `@peltier/db`,
  `@peltier/db/schema`, `@peltier/db/client`, `@peltier/shared`.
- shadcn/ui is installed **per app**, not shared.
- Tailwind v4 CSS-first config (no `tailwind.config.js`); tokens in
  `app/globals.css`.
- Route protection uses `proxy.ts` (Next.js 16 convention, replaces
  `middleware.ts`) — export a named `proxy` function.
- `.private/` holds the legacy archive, customer data and DB backups. It is
  gitignored and must never be committed.
