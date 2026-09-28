# HM Froid - Handoff Document

> This document is the entry point for any new chat session working on this project.
> Read this first before making any changes.

## Project Identity

**HM Froid** (abbreviated **HMF**) is an e-commerce platform for HM Refrigeration, a Belgian professional refrigeration business. The project consists of a customer-facing storefront and an admin panel for managing products, orders, inventory, and content.

- **Domain:** hmfroid.be
- **Panel:** panel.hmfroid.be
- **Repository:** https://github.com/aliaddas/hm-froid

---

## Architecture

```
hm-froid/                          (Turborepo + pnpm monorepo)
├── apps/
│   ├── hm-froid/             Next.js 16 storefront (:3000)
│   └── peltier-admin/                 Next.js 16 admin dashboard (:4000)
├── packages/
│   ├── db/                        Drizzle ORM schema + client (PostgreSQL)
│   └── shared/                    Zod validators, utilities, constants
├── caddy/                         Reverse proxy (Caddyfile)
├── docker-compose.yml             Production stack
├── docker-compose.dev.yml         Development override
└── hm-froid.code-workspace        Cursor multi-root workspace
```

Both apps share the same PostgreSQL database through `@peltier/db`. There is no dedicated API server -- each app uses Next.js API routes and Server Actions for mutations, plus direct DB reads through the shared package.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, RSC, Server Actions) |
| Package Manager | pnpm 9.15.4 (workspace protocol) |
| Monorepo | Turborepo |
| ORM | Drizzle ORM + postgres-js driver |
| Database | PostgreSQL 17 |
| Auth | Better Auth (self-hosted, email/password + OAuth) |
| Data Fetching | TanStack Query v5 |
| Client Sync | TanStack DB v0.6 (panel only, client-side live queries) |
| Forms | TanStack Form v1 + Zod (Standard Schema, no adapter) |
| Validation | Zod 4 |
| UI | Tailwind CSS v4 + shadcn/ui (new-york style) |
| Animations | Motion (framer-motion) + animate-ui registry |
| State | Zustand v5 (cart, UI state) |
| Toasts | Sonner |
| Icons | Lucide React |
| Reverse Proxy | Caddy 2 (automatic HTTPS) |
| Containerization | Docker (node:22-alpine, standalone output) |

---

## Running Locally

```bash
# Install dependencies
pnpm install

# Start both apps in dev mode
pnpm dev

# Or individually
pnpm --filter peltier-admin dev      # localhost:4000
pnpm --filter hm-froid dev  # localhost:3000

# Database
pnpm db:push                     # Push schema to DB (no migration files)
pnpm db:generate                 # Generate migration files
pnpm db:migrate                  # Run migrations
pnpm db:studio                   # Open Drizzle Studio
```

Requires a running PostgreSQL instance. Use docker-compose for convenience:
```bash
docker compose up postgres -d
```

---

## Database Schema (~35 tables)

The schema is organized into domain files at `packages/db/schema/`:

| Domain | Tables | File |
|--------|--------|------|
| Auth | user, session, account, verification | auth.ts |
| Store | store, storeSettings | store.ts |
| Catalog | category, product, productImage, productCategory, tag, productTag | catalog.ts |
| Variants | productOption, productOptionValue, productVariant, variantOptionValue | variants.ts |
| Inventory | inventoryItem, inventoryHistory | inventory.ts |
| Cart | cart, cartItem | cart.ts |
| Orders | order, orderItem, orderStatusHistory | orders.ts |
| Payments | payment, refund | payments.ts |
| Addresses | address | addresses.ts |
| Shipping | shippingZone, shippingRate, shipment | shipping.ts |
| Tax | taxZone, taxRate | tax.ts |
| Discounts | discount, discountCondition, discountUsage | discounts.ts |
| Content | post, blogCategory, postCategory | content.ts |
| Reviews | review, wishlistItem | reviews.ts |
| Support | discussion, message | support.ts |
| Notifications | notification | notifications.ts |

### Variant Model (important)

The variant system uses industry-standard naming:
- **ProductOption** = a dimension (e.g., "Capacity", "Color")
- **ProductOptionValue** = a specific value (e.g., "400L", "Stainless Steel")
- **ProductVariant** = the actual sellable SKU (combination of option values with its own price, stock, weight, barcode)

A product's `basePrice` is the default. Each variant can have a `price` override (nullable -- falls back to basePrice if null).

---

## Auth Strategy

Better Auth is mounted in both apps at `/api/auth/[...all]`. They share the same DB tables. Users have a `role` field: `ADMIN`, `STAFF`, or `CUSTOMER`.

- **Panel:** Requires authenticated user with ADMIN or STAFF role
- **Marketing:** Public by default, auth required for /account/* routes

Auth client utilities are at `lib/auth-client.ts` in each app.

---

## Maintenance Mode

The panel controls the marketing site's maintenance state via the `store_settings` table. The marketing middleware checks this on each request (with a 30-second cache). This replaces the old ENV-variable approach.

---

## Conventions

- **Import aliases:** `@/*` maps to the app root in both apps
- **Shared packages:** Import as `@peltier/db`, `@peltier/db/schema`, `@peltier/db/client`, `@peltier/shared`, `@peltier/shared/utils`, `@peltier/shared/validators`, `@peltier/shared/constants`
- **Component library:** shadcn/ui installed per-app (not shared). Use `npx shadcn@latest add <component>` inside each app
- **CSS:** Tailwind v4 CSS-first config (no tailwind.config.js). Design tokens in `app/globals.css`
- **Forms:** TanStack Form + Zod. Pass schema directly to `validators: { onChange: schema }`. No adapter needed.
- **Data fetching (panel):** TanStack Query for server state. TanStack DB for live dashboard widgets (client-only, use 'use client').
- **Data fetching (marketing):** TanStack Query + RSC for SEO pages. Zustand for cart state.
- **Route protection:** Uses `proxy.ts` (Next.js 16 convention, replaces middleware.ts). Export a named `proxy` function.

---

## What Is Built vs What Remains

### Done (scaffolded)
- [x] Monorepo structure (Turborepo + pnpm)
- [x] Full Drizzle schema (35 tables, enterprise-grade e-commerce)
- [x] Better Auth setup (both apps)
- [x] TanStack Query + Form provider setup
- [x] TanStack DB + query-db-collection (panel)
- [x] Tailwind v4 + shadcn/ui config (both apps)
- [x] Proxy (auth protection + maintenance mode, Next.js 16 proxy.ts convention)
- [x] Docker + Caddy setup (production + dev overrides)
- [x] Workspace file for Cursor
- [x] Zod 4 validators (Standard Schema, works natively with TanStack Form)
- [x] `pnpm install` (lockfile generated, both apps start cleanly)

- [x] Marketing landing page (hero with R3F 3D ice cube, dark/light themes, Anton display font, parallax sections — see `apps/hm-froid/components/landing/`)

### TODO (future sessions)
- [ ] shadcn/ui components (run `npx shadcn@latest add button card input` etc. in each app)
- [ ] Product CRUD UI (panel)
- [ ] Variant builder UI (panel)
- [ ] Order management UI (panel)
- [ ] Blog editor (panel)
- [ ] Store settings page (panel, maintenance toggle)
- [ ] Product catalog pages (marketing)
- [ ] Product detail pages (marketing)
- [ ] Shopping cart + checkout flow (marketing)
- [ ] Stripe payment integration
- [ ] Customer account pages (marketing: order history, addresses)
- [ ] Blog pages (marketing)
- [ ] Image upload (Supabase Storage or S3)
- [ ] Email notifications (Resend)
- [ ] Search (product search, possibly Meilisearch later)
- [ ] SEO (meta tags, structured data, sitemap)
- [ ] i18n (if needed -- currently fr-BE only)

---

## Key Decisions Log

1. **Next.js over TanStack Start** -- TanStack Router/Start is incompatible with Next.js App Router. We use TanStack Query + Form + DB as add-ons instead.
2. **Drizzle over Prisma** -- Lighter (~12KB vs 1.6MB), no generate step, better cold starts for Docker.
3. **Better Auth over Clerk** -- Self-hosted, no per-user cost, TypeScript-first, owns the data.
4. **No dedicated API server** -- Next.js API routes + Server Actions. Both apps access DB directly.
5. **Caddy over Traefik** -- Simpler config, automatic HTTPS, fewer moving parts.
6. **pnpm over bun** -- Proven workspace support, matches existing kyf-moves patterns, better ecosystem compatibility.
7. **Shared packages over code duplication** -- Unlike kyf-moves which duplicates lib/ across apps, HMF uses `@peltier/db` and `@peltier/shared` as shared workspace packages.
