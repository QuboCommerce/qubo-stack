# Peltier Stack — Handoff

> Entry point for any new chat session. Read this before making changes.
> Last verified: 2026-09-28.

## What this is

**Peltier Stack** is a self-hosted, multi-store commerce platform built for
Mostapha Hilal (aka Wooster), who runs two businesses:

| Business | What it sells | Status |
| --- | --- | --- |
| **HM Froid** | Industrial/commercial refrigeration (since 2008) | Migrating off ShopApplication — **urgent** |
| **TailG Belgium** | Electric scooters | Still on Odoo, **not yet migrated** |

One control plane (`peltier-admin`) manages many storefronts, Shopify-style
store switching, but fully owned. A fridge and an e-scooter are ~98% the same
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
│   ├── db/         @peltier/db    Drizzle schema + client (PostgreSQL)
│   └── shared/     @peltier/shared Zod validators, utils, constants
├── caddy/Caddyfile
├── scripts/                       legacy archive + importer + link-env
├── .zed/                          settings.json + tasks.json
└── docker-compose.yml
```

### Docker topology

| Service | Container | Port |
| --- | --- | --- |
| Database | `peltier-postgres` | 127.0.0.1:55433 → 5432 |
| Control plane | `peltier-admin` | 4000 |
| Storefront | `hm-froid` | 3000 |
| Edge proxy | `caddy-edge` | 80/443 |

Network: `peltier-network`. Compose project name: `peltier`.
A `peltier-elysia` API service is planned but **does not exist yet**.

## Running locally

```bash
cp .env.example .env          # then fill values
pnpm install                  # postinstall links root .env into each app
docker compose up -d peltier-postgres
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
`organizationMember`, `store`, `storeDomain` (multi-tenancy), `customerGroup`
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
| store_customer | 2263 |
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
4. **`peltier-admin` is thin.** Read-only lists for products/orders/customers.
   No product CRUD, no variant builder, no media manager. This is the real gap
   between "skeleton" and "product".
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
7. **Puck (MIT) for page building** — store versioned block JSON, never
   generated React source. AI should emit validated block trees from approved
   component schemas; executing merchant-authored React in the panel is a
   security and deployment hazard.
8. **`peltier-elysia` planned** — justified once three consumers (admin + two
   storefronts) share tenancy and pricing rules. If storefronts keep direct DB
   access "just for reads", the API becomes decorative and you get two sources
   of truth.

## Roadmap

- [x] Rename/restructure to `peltier-stack`, push to GitHub
- [x] Zed workspace (`.zed/settings.json`, `.zed/tasks.json`)
- [ ] `packages/api` — Elysia on Bun, auth + tenancy middleware
- [ ] Multi-storefront seams so `tailg-belgium` drops in frictionlessly
- [ ] Puck install + `page`/`pageRevision` schema in `peltier-admin`
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
