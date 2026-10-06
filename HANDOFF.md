# Qubo Stack — Handoff

> Entry point for any new chat session. Read this before making changes.
> Last verified: 2026-09-30.

## What this is

**Qubo Stack** is a self-hosted, multi-site business platform built for
Mostapha Hilal (aka Wooster), who runs two businesses:

| Business | What it sells | Status |
| --- | --- | --- |
| **HM Froid** | Industrial/commercial refrigeration (since 2008) | Migrating off ShopApplication — **urgent** |
| **TailG Belgium** | Electric scooters | Still on Odoo, **not yet migrated** |

One control plane (`qubo-admin`) manages many **Sites**, Shopify-style
site switching, but fully owned. A Site has a **type** (`store`, `services`,
`business`, `editorial`, `custom`) — the preset it was created from; both
HM Froid and TailG are `store` sites. A fridge and an e-scooter are ~98% the same
product shape, so a single catalog/variant/pricing model serves both.

- **Repository:** https://github.com/aliaddas/qubo-stack (push via SSH)
- **Live legacy site being replaced:** hmfroid.be

## Architecture

```
qubo-stack/                     Turborepo + pnpm workspace
├── apps/
│   ├── qubo-admin/             Next.js 16 control plane (:4000)
│   └── qubo-storefront/        Next.js 16 storefront for every site, resolved by host (:3000)
├── packages/
│   ├── api/        @qubo/api   qubo-elysia: Elysia on Bun, auth + tenancy (:3333)
│   ├── db/         @qubo/db    Drizzle schema + client (PostgreSQL)
│   ├── shared/     @qubo/shared Zod validators, utils, constants, site-url/admin-url helpers
│   ├── protocol/   @qubo/protocol instance ↔ Portal ↔ Cubicles schemas (own version)
│   ├── stylekit/   @qubo/stylekit themes: palette → schemes → CSS vars, Palette Doctor
│   ├── blocks/     @qubo/blocks  schema-first Puck block library + render/editor configs
│   ├── studio/     @qubo/studio  server services: documents, revisions, themes, translations, pages
│   ├── realtime/   @qubo/realtime platform event bus: Postgres outbox + LISTEN/NOTIFY → SSE
│   └── storefront/ @qubo/storefront typed client for storefronts → API (pinned to /v1)
├── .changeset/                    Changesets; one fixed version for the product (0.0.2)
├── scripts/                       legacy archive + importer + link-env
├── .zed/                          settings.json + tasks.json
└── docker-compose.yml
```

### Docker topology

| Service | Container | Port |
| --- | --- | --- |
| Database (dev) | shared Supabase CLI stack `react`, database `qubo` | 127.0.0.1:54322 |
| Database (legacy, retiring) | `qubo-postgres` | 127.0.0.1:55433 → 5432 |
| API | `qubo-elysia` | 3333 |
| Control plane | `qubo-admin` | 4000 |
| Storefront (all sites) | `qubo-storefront` | 3000 |
| Edge proxy | Coolify's Traefik, or `qubo-edge` (`--profile edge`) | 80/443 |

Network: `qubo-network`. Compose project name: `qubo`.

### Database: Supabase (since 2026-09-30)

Dev runs on the machine-wide Supabase CLI stack (`supabase_*_react`), in its
**own database** `qubo`, owned by a login role `qubo`. Isolation comes
from Postgres itself: `CONNECT` on the database is revoked from `PUBLIC`, so
Supabase's API roles (`anon`, `authenticated`, `service_role`) and PostgREST
cannot reach it — PostgREST only serves the `postgres` database. Drizzle owns
`public` inside `qubo`; nothing else writes there.

Production gets its own VPS with a dedicated self-hosted Supabase; the same
database-per-project layout applies. `qubo-postgres` stays in compose until
that cutover. Files don't use Supabase Storage: `@qubo/storage` writes to local
disk (`STORAGE_DIR`, the compose `media` volume) or any S3-compatible bucket
(`STORAGE_ENDPOINT`), see decision 22.

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

`@qubo/db` throws on a missing `DATABASE_URL` rather than silently
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
| Proxy | Traefik v3 (HTTP provider fed by the API) |

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
4. **`qubo-admin` has a real shell but little CRUD yet.** Site-scoped routes
   (`/[site]/…`), capability-driven sidebar, ⌘K palette, dashboard, paged
   products/customers, orders, themes and settings hub, and the Studio editor
   (`/[site]/studio/…`: Puck canvas, view picker, autosave, publish, history,
   Add-section modal with live thumbnails, Theme panel), media library. Still missing:
   variant builder. Unbuilt
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
8. **`qubo-elysia` owns tenancy** — three consumers (admin + two
   storefronts) share tenancy and pricing rules. The acting site comes from the
   `x-qubo-site` header (admin switcher) or the request hostname
   (`site_domain`). If storefronts keep direct DB
   access "just for reads", the API becomes decorative and you get two sources
   of truth.

9. **Studio blocks are schema-first and self-styled** — every block is declared
   once with `f.*` fields (Zod schema, Puck field, JSON Schema for AI,
   translations, blueprint tokens all derive from it). Blocks ship their own CSS
   (`blockCss`, emitted by `ThemeStyles`) driven by StyleKit CSS variables, so
   a document renders identically in the Studio iframe and any storefront
   without depending on the host app's Tailwind. Defaults are filled at render
   time, so sparse/AI-written props never crash. Rendered by
   `apps/qubo-storefront` (see `docs/storefront.md`).
10. **StyleKit roles are semantic** — `accent` is a fill (paired with
   `onAccent`); `accentText` is accent used as text (eyebrows, highlights) and
   falls back to `link`. Schemes reference palette tokens only.
11. **Admin URLs are site-scoped** — `/{siteSlug}/products` etc. Layout calls
   `requireSite(slug)` (membership check → 404). Server actions receive the
   slug via a hidden `site` input and call `requireSiteFromForm`. Navigation is
   derived from `site.capabilities` (`lib/navigation.ts`), so a services site
   never sees Orders/Products. Pages use `<Page width>` tiers and
   `@container` queries; breakpoints go up to `5xl` (3440px ultrawide).
12. **Admin route groups** — `app/(app)` holds the admin (its own root layout +
   `globals.css`); `app/(canvas)` is a bare root layout used for iframed block
   previews (`/canvas/{site}/{BlockType}?preset=&mode=blueprint&theme=`), so
   storefront blocks never inherit admin CSS. The block library
   (`/{site}/online-store/blocks`) and inspector render through it.
13. **Settings pattern** — two-pane shell (`components/settings/*`): the list
   is the index on phones, a sticky sidebar from 52rem container width. Pages
   use `SettingsGroup` (annotated layout ≥72rem) + `Surface`. Editable pages
   wrap fields in `SettingsForm` (useActionState, Shopify contextual save bar,
   ⌘S, discard, beforeunload, read-only for non OWNER/ADMIN). Its dirty
   tracking uses native input/change listeners because `form.reset()` bypasses
   React's value tracker. Section list lives in `components/settings/sections.ts`;
   unbuilt sections render a placeholder via `settings/[section]`.
14. **Studio services** — `@qubo/studio` owns every Studio rule (site
   scoping, optimistic `draftVersion`, migrate→validate on save, publish
   revisions, restore/rollback, asset usage, translation staleness). The admin
   calls it from server actions; `packages/api` exposes the same services at
   `/v1/studio/*` (admin, `If-Match` → 409) and `/v1/render/*` (anonymous storefront
   reads: published docs + locale overlay, `theme.css` with ETag, signed
   `?preview=` tokens). Drafts accept prop-level warnings; publish is strict.
   Integration tests (`pnpm --filter @qubo/studio test`) build a throwaway
   org and delete it via cascade.
15. **Theme editing lives in the Studio** — the left rail's Theme tab
   (`components/studio/theme/*`, or `studio?panel=theme`) edits the theme
   *draft* next to the live canvas: palette tokens (OKLCH editor, lock,
   "used by", safe rename), named schemes per mode with mixes, light/dark
   strategy (collapse/expand), typography, radius/buttons/shadows, motion,
   spacing, flavor, and the Palette Doctor with jump-to-fix. It has its own
   undo history (`useThemeEditor`; top-bar undo/⌘Z follow it while the panel is
   open) and autosaves through the same `useDocumentSync` as pages. Publish is
   combined: theme first, then the page. Theme "unpublished" is compared after
   `ThemeSchema` defaults, so authored vs. normalised copies match.
   Fonts may declare `weights` (set from the admin font catalog);
   `googleFontsUrl` snaps requested weights to them, so a family without 700
   can't fail the css2 request.
16. **Realtime = Postgres outbox + SSE** (`@qubo/realtime`, no Redis/WebSocket
   server). `publish()` inserts into `platform_event` and `pg_notify`s the id in
   one statement (NOTIFY caps payloads at 8 kB); one LISTEN connection per process
   fans out to subscribers. Events carry `siteId`/`orgId`/`userId` scope and are
   filtered per audience. Rows live 7 days: SSE resumes from `Last-Event-ID`
   or `?since=`, and an older cursor gets `event: reset` (the client refetches).
   The admin mounts it at `/api/events` (same-origin session cookie; ADMIN/STAFF
   only) and `/api/events/poll` (JSON fallback the client switches to after
   repeated SSE failures). Server actions call `lib/events.ts` (`emitEntity`,
   `emitDocumentPublished`, `emitThemePublished`), which never throws. Read-only
   pages add `<LiveRefresh tables={[…]}/>` to debounce `router.refresh()` on
   other users' changes; forms do **not** auto-refresh (conflicts are
   p3-form-conflicts). New event types go in `packages/realtime/src/index.ts`.
17. **Presence is in memory, never stored.** Each tab POSTs `/api/presence`
   (route, document, selected block, focused field; debounced 2 s, heartbeat
   30 s visible / 60 s hidden, `sendBeacon` leave on pagehide). `createPresence`
   keeps entries per process with a 90 s TTL and broadcasts the site's full
   snapshot as the *ephemeral* `presence.changed` (`hub.broadcast`: no row, no
   id, not replayed). The focused field is picked up automatically from
   `focusin` on any named control inside a `<form>` (override with
   `data-presence-field`). UI in `components/presence.tsx`: `PresenceStack`
   (top bar), `RowPresence path` (index rows), `FieldPresenceOverlay` (mounted
   by `LiveEvents`), `DocumentPresence` + `BlockPresenceOverlay` (Studio; drawn
   inside Puck's iframe with inline styles). Multiple admin processes would each
   see only their own tabs; fine on one VPS, a shared store is the scale-out step.
18. **Sessions are tracked per device and signing in again asks before kicking.**
   Better Auth's `session.create.after` hook writes a `session_device` row
   (parsed UA, IP, geo city; no FK so ended rows survive the session delete).
   `cookieCache` is **off** so a deleted session is rejected immediately. After
   sign-in the form calls `/api/sessions`; if another device was active in the
   last 30 min it offers "Sign out that device" (`/api/sessions/takeover`) or
   Cancel (signs the new session out), so it never kicks without asking. `endSession`
   emits `session.revoked` (`reason: takeover|revoked`) to that user; the
   ended tab shows a blocking dialog, and the sign-in page explains why via
   `endedNotice`. Settings → Security & sessions lists devices with revoke.
   Geo is `@qubo/geo`: a local DB-IP Lite mmdb (CC BY 4.0, attribution shown),
   no external calls. Refresh monthly with `pnpm --filter @qubo/geo update`;
   path `$QUBO_GEO_DB` or `.private/geo/dbip-city-lite.mmdb`. Missing DB →
   locations are just blank. Storefront → admin one-time handoff tokens are
   deferred to p4-domains.
19. **Forms merge instead of overwriting.** A form renders with `base` (its
   values as the server produced them, from `lib/form-specs.ts`) and posts it
   as hidden `_base`. The action loads the current row and calls `reconcile`
   (`lib/merge-server.ts`): it does a three-way merge per field. Fields only they changed
   are folded in silently, and fields both changed return `{ conflict }`, which
   `SettingsForm` shows as `MergeSheet` (keep mine / use theirs per field). The
   write is a CAS on `updated_at` (`unchangedSince`, ms-truncated). With
   `watch={{table,id}}` a clean form `router.refresh()`es and remounts on
   `entity.updated`; a dirty one keeps its original base and shows a
   "saved changes · Review" banner (`_preview=1` = dry-run merge). No `version`
   columns: the base snapshot catches strictly more and needs no migration.
   New form = add a `*Values`/`*Spec` pair, pass `base`/`watch`/`noun`, call
   `reconcile` before validating. Wired: product, category, site general.
20. **Studio: one editor, live followers.** A Studio document has a lease
   (`studio_lease`, `lib/lease.ts`, `POST /api/studio/lease`): the first tab to
   open it edits, and the others follow read-only (Puck `permissions` all false).
   The holder renews every 10 s (TTL 30 s) and releases on pagehide. A freed lease is taken
   by whoever is still there. "Request edit" toasts the holder (Give control /
   Keep). The lease is granted at once if the holder is the same user (other tab), idle
   for 60 s, or gone. The holder streams its canvas as JSON Patch
   (`fast-json-patch`, 200 ms batches) through `POST /api/studio/live`, which accepts only
   the lease holder. Followers apply `document.patched`
   (ephemeral) by `epoch`/`seq` and refetch the in-memory snapshot
   (`lib/live-docs.ts`, per process) on a gap. Handover flushes the holder's
   autosave first. The new holder rebases autosave on the saved draft and keeps
   the live canvas. Spectate: clicking a peer avatar follows their page,
   focused field and Studio block (`components/spectate.tsx`, survives
   the app ↔ Studio switch via sessionStorage; Esc / navigating stops it).
   Not done: theme edits are not leased; they keep the version CAS of
   `useThemeEditor`. No CRDT and no block-level merge in the draft
   `ConflictDialog`, because the lease makes concurrent canvas edits impossible.

21. **Inbox: one conversation model for every channel.** `conversation` + `message`
   (`packages/db/schema/support.ts`, migration 0013 dropped `discussion`) back the
   admin inbox (`/[site]/inbox`, three panes, views open/mine/pending/resolved/all).
   Logic lives in `@qubo/inbox`: pure helpers in `src/index.ts` (limits, honeypot
   `_company_website`, EN/NL/FR field heuristics, rate limiter) and DB/email in
   `src/server.ts` (`submitForm`, `reply`, `updateConversation`). Forms post to the
   storefront `POST /api/forms/:key` (JSON, urlencoded or multipart, no-JS 303
   back to the referer), which forwards to `POST /v1/forms/:key` on the API with a
   signed visitor IP (`@qubo/shared/client-ip`). Unknown keys auto-create a form
   (max 25 per site), honeypot hits are stored as spam but answered ok, and
   e-mail-only forms (newsletter) store a submission without a conversation.
   Replies are stored first and then e-mailed through Resend (`RESEND_API_KEY`,
   `EMAIL_FROM`), and a failure lands in `message.delivery_error`. Notes are internal.
   Events `conversation.created|message|updated` drive `InboxLive` (refresh) and the
   sidebar badge (unread, not resolved). Chat: the `ChatLauncher` block talks to
   `/api/chat*` on the storefront (httpOnly `qb_chat` token, hashed in
   `conversation.visitor_token_hash`, or the customer session) and `/v1/chat*` on
   the API, whose `/stream` SSE filters the realtime hub to that one conversation.
   The stream keeps `visitor_seen_at` fresh; staff chat replies are e-mailed only
   when the visitor has been away for `CHAT_AWAY_MS` (90 s). E-mail in: Resend
   `email.received` webhook at `/webhooks/resend` (Svix-verified, body fetched from
   Resend). Routing: `reply+<conversationId>@EMAIL_INBOUND_DOMAIN`, then
   In-Reply-To/References against `message.email_message_id`, then sender + base
   subject, else `<site-slug>@` opens an `email` conversation. Snooze sets
   `snoozed_until`; `wakeSnoozed()` runs every minute in the API (and lazily on
   the inbox list) and reopens them unread. SLA is display-only (`SLA` in
   `@qubo/inbox`: amber 4 h, red 24 h of a customer waiting). Settings → Inbox
   shows e-mail in/out status and edits each form's name and notify list.
   Attachments: bytes in storage at `inbox/<site>/<conversation>/<file>.<ext>`,
   one `inbox_file` row each; `message.attachments` keeps a display copy
   (`{id, name, size, type}`) so a purged file still shows as "expired". Never
   public: the admin serves `/api/inbox-files/<id>?site=` to site members, the
   API serves `/v1/chat/files/:id` only to the conversation's own visitor and
   never for internal notes. Visitors send up to 3 images/PDFs (10 MB) in the
   same multipart request as the text, so nothing is uploaded before a
   conversation exists; those expire after 30 days unless staff "Keep" them.
   Staff uploads are drafts (`/api/inbox-files`, a route handler since actions
   cap bodies at 1 MB) claimed by the reply they're sent with; abandoned drafts
   go after a day. `purgeInboxFiles()` runs hourly in the API. E-mailed replies
   carry their files as Resend attachments (25 MB budget). Received e-mail:
   files are downloaded from Resend's attachment list and checked like uploads;
   small inline images (signatures) are skipped and anything unsupported is
   listed as "Not imported". "Save to media library" copies a file into the
   org's library. Not built yet: form file fields, cross-site inbox (planned
   for the site switcher), portal tickets, typing indicators.
22. **Media library: one per organisation, served by our own apps.** `asset` rows
   belong to the org; `site_id` is the uploading site, null = shared by every site
   of the org. Not per account: an org is the billing and legal unit and published
   sites never move between orgs. `@qubo/storage` picks the driver (disk when only
   `STORAGE_DIR` is set, S3 via aws4fetch when `STORAGE_ENDPOINT` is), sniffs file
   content against the extension, and keys files `media/<org>/<asset>.<ext>`. The
   key has no site, so sharing a file never changes its URL. Admin and storefront
   both serve `GET /api/media/<org>/<asset>.<ext>` (immutable cache, nosniff,
   sandbox CSP so SVG can't script). Uploads go through `POST /api/media-library`
   (route handler: server actions cap bodies at 1 MB). QuickPick
   (`components/media/quick-pick.tsx`) is the browser on `/[site]/media` and the
   picker dialog for Studio media fields (`mediaFieldAdapter`) and product
   galleries. `MediaValue` stores `assetId` + `url` (+ width/height), so rendering
   needs no lookup. Usage: Studio indexes documents in `asset_usage`; product
   galleries write `product:<id>` rows. Deleting warns with the usage, drops the
   file from product galleries, and leaves pages with a missing image. Not built
   yet: image resizing/transcoding, blurhash, folders, copying between orgs.
23. **Inbox AI: bring your own key, per organisation, never auto-sends.**
   `@qubo/ai` holds the provider catalogue (OpenAI, Anthropic, xAI, Mistral,
   OpenRouter, any OpenAI-compatible server such as Ollama), prompts and a plain
   `fetch` client for both wire formats; no SDKs. `ai_settings` (one row per org)
   stores the key AES-256-GCM sealed with a key derived from `QUBO_PREVIEW_SECRET`
   (dev falls back to `BETTER_AUTH_SECRET`); rotating that secret means re-entering
   keys. Gate: plan feature `ai` (Starter and up) and the org not locked. Every call
   writes an `ai_usage` row (tokens, no content) for the monthly token budget.
   Triage: the API sweeps every 5 s for open threads whose newest customer message
   is 8 s quiet and not yet read (`conversation.ai.messageId`), max 10 per sweep,
   with per-thread backoff on failures. It writes `conversation.ai`, replaces one
   `ai:<category>` tag, adds `spam` (never resolves), and only ever raises priority.
   Drafts: "Draft with AI" fills the composer from the last 20 public messages,
   the customer's last 5 orders, up to 5 products ranked by matching terms (ILIKE,
   triage-named products weigh double) and the site's `ai_instructions`. Custom
   server URLs are fetched from our server: set `AI_PRIVATE_URLS=deny` on shared
   hosting. Not built yet: pgvector RAG (prod image lacks it; Anthropic has no
   embeddings), auto-replies, the Puck editor assistant.
24. **Sites and organisations are created in the admin; a site is born complete.**
   The site switcher is a mega menu (`components/shell/site-switcher.tsx`): one
   section per organisation the user belongs to, empty ones included, with
   OpenGraph-style cards whose thumbnail is painted from the site's active theme
   (`lib/shell.ts` resolves background, primary and text through stylekit), an
   unread badge that deep-links into that site's inbox, a "View site" chip, and a
   lock veil for sites outside the plan. Layout: stacked list under 4 sites, two
   columns at 4, three at 6; search appears above 5. The footer shows plan usage
   and the two create buttons; when a quota is full the button becomes a lock
   that links to Settings → Qubo Portal. Provisioning lives in `@qubo/studio`
   (`provision.ts`): `createOrganization` makes the caller OWNER;
   `createSite` runs one transaction that inserts the site with the preset's
   capabilities, `site_settings`, one primary locale, every template of the preset
   as a published document with revision 1, header and footer section groups, an
   active built-in theme picked by site type (store and custom: Smossie,
   services and editorial: Lumé, business: HM Froid) and the `contact` form.
   Slugs are derived from the name and de-duplicated with `-2`, `-3`. Server
   actions in `app/provision-actions.ts` re-check `access()` quotas and that the
   user manages the target organisation; the site count is the real ceiling
   across all organisations, not per organisation. Not built yet: delete site,
   logo upload during creation, cross-site inbox.
25. **Custom domains are self-service; Traefik learns them from the API.**
   Settings → Domains connects a domain (`app/domain-actions.ts`), enforcing
   `customDomainsPerSite` from the plan and one site per hostname. `@qubo/domains`
   holds the rules: `parseDomain` (pasted URLs, IDN, rejects IPs, public suffixes,
   `qubo.`/`preview.` and the platform base), the records each domain needs
   (A for the host, TXT `_qubo-verify`, recommended `www` and `qubo` CNAMEs),
   per-record grading against public resolvers (`ok`, `missing`, `wrong`,
   `proxied` for Cloudflare orange cloud, `ipv6` for a stray AAAA) and DNS
   provider detection from nameservers with panel paths for about 20 hosts. The
   API sweeps due domains every 15 s (`next_check_at`: 30 s for a fresh domain,
   backing off to 12 h; verified ones every 6 h) and publishes
   `site.domain.changed` on any status change, so the page updates live. A domain
   is verified the first time the A and TXT records hold and is never
   un-verified by a later failed check. `GET /v1/edge/traefik` (optional
   `QUBO_EDGE_TOKEN` as `?token=`) returns routers for every verified domain
   plus its `qubo.`, `preview.` and `www.` hosts (www redirects to the apex),
   the platform subdomains, and `qubo.<ip>.sslip.io` as the install-day admin
   address until a first domain is verified. Coolify's proxy polls it
   (docs/VPS.md); `docker compose --profile edge` runs a standalone Traefik
   for servers without Coolify. Caddy is gone. Each domain has a login-free
   setup link (`/dns/<token>`, revocable) for whoever manages the DNS. Gaps:
   the portal does not yet map organisations to server IPs, removing a domain
   leaves its certificate in the edge store until it expires, and only
   `QUBO_SERVER_IP` (or the resolved public URL) decides which IP is correct.
26. **Agent skills are vendored, plans live in `docs/plans/`.** General skills
   are copied into `.agents/skills/` as plain files (MIT, upstream LICENSE kept
   per folder): Matt Pocock's grill-me, grilling, tdd, diagnosing-bugs,
   code-review, pr, codebase-design, improve-codebase-architecture,
   domain-modeling, to-tickets, handoff, writing-for-agents and prototype;
   blader's humanizer; elayadesign's landing-page-design, rewritten so visual
   values defer to the theme. Issue-tracker driven skills (triage, to-spec,
   wayfinder) are skipped: tickets are rows in `docs/plans/*.md`, decisions are
   here (`docs/agents/issue-tracker.md`). `qubo-design-language` holds the
   concept tree from `docs/plans/design-system.md` and the taste review.
27. **Design language is theme data plus a few field kinds (ds1).** New concepts
   land as a theme section with built-in presets and defaults (`brand`,
   `surfaces.gradients`, `decor`, `effects`, `motion.transitions`,
   `motion.nav`), so saved themes keep parsing, and blocks reference presets by
   id through `f.preset(kind)`, `f.decor(of)`, `f.duration`, `f.easing`.
   Anything coloured by a preset is compiled as a selector rule on the element
   (`[data-gradient=id]`, `[data-decor=id]`, `[data-effect=id]`), never a root
   variable, because role vars change per scheme. Decor ranges are character
   offsets keyed by the hash of the exact text they were picked on, so each
   locale keeps its own and edited text falls back to the `match` phrase.
   Marks are inline SVG revealed with a clip-path wipe on a timer:
   `pathLength` breaks under `vector-effect: non-scaling-stroke`, and a view()
   timeline never finishes for above-the-fold heroes. Blocks now also apply
   `migrate` steps at render, since published documents are not re-saved.
   Aurora avoids `filter: blur` (raster glitches and cost). Native page
   transitions are `motion.transition = "native"` (`@view-transition`);
   overlay presets and the snow/particles canvas arrive with the ds3 runtime.
28. **One runtime drives the studio previews and the storefront (ds2).**
   `@qubo/blocks/runtime` holds the transition overlay (`createTransition`,
   `previewTransition`, WAAPI, fixed or contained scope) and the effects canvas
   (`startEffect`, colour read from the canvas's computed `color`, paused off
   screen and on hidden tabs, one still frame for reduced motion). The theme
   panel's Test buttons call the same code the ds3 islands will, so a preview
   cannot drift from production. Theme pages (Brand, Gradients, Word
   highlights, Effects, Transitions with menu motion) preview inside
   `ThemeScope` with the compiled CSS. The Puck field sidebar has no theme CSS
   (the canvas is an iframe), so field swatches use resolved colours and the
   "Highlight words" dialog renders its own `ThemeStyles`. That dialog lists
   every locale's text (`localeTextsAction`), picks whole words with
   `Intl.Segmenter`, merges neighbours into one range and offers to drop ranges
   whose text hash no longer matches.
29. **Sites run one framework-free runtime island (ds3).** The storefront
   mounts `SiteRuntime`, a thin client wrapper over `startSiteRuntime` in
   `@qubo/blocks/runtime`, and passes it only `brand` and `motion` (with the
   one active transition) via `runtimeTheme`, so the palette never ships twice.
   It starts snow/particle canvases, pauses below-the-fold decor draw-ins
   until they scroll into view, and switches on a scheduled site-wide effect
   (rendered hidden by `ThemeRoot` with `data-effect-schedule`, so cached
   pages stay correct across the date window). Overlay page transitions work
   across full page loads: a click covers, the computed cover colour goes to
   `sessionStorage`, and an inline `<body>` script on the next page paints the
   same colour before first paint, then the runtime swaps in the real overlay
   and uncovers after `load` and `minVisible` (capped at 2.5 s; a CSS fallback
   fades the cover if JS never runs). Back/forward cache restores uncover.
   `native` stays pure CSS (`@view-transition`). No animation library was
   added: WAAPI and CSS cover every current preset. Brand favicon/mark and
   sharing image feed `viewMetadata`. Known gap: preview hosts render draft
   documents with the published theme.
30. **Header menus are native popovers (ds4).** `SiteHeader` has five layouts
   (`bar`, `bar-mega`, `sidebar`, `sheet`, `fullscreen`) plus a small-screen
   menu kind (`drop`, `sheet`, `fullscreen`) and a side (left, right, top,
   bottom). Every menu panel is a `popover` opened by `popovertarget`, so it
   opens, closes, light-dismisses and sits in the top layer with no
   JavaScript; this replaced the `<details>` mobile menu. Enter and leave come
   from `theme.motion.nav` as `data-enter` / `data-exit` on the panel and play
   in CSS (`@starting-style`, `transition-behavior: allow-discrete`), so the
   studio and the storefront need no motion code. Desktop dropdowns stay
   `<details name>` (exclusive accordion). `startNav` in the site runtime only
   adds polish: the circle grows from the menu button, a menu link closes the
   menu before the page cover, Escape and outside clicks close dropdowns, and
   a bar whose links do not fit first drops the search field to an icon and
   then collapses to the menu button (`data-overflow`). The sidebar is a fixed
   rail above 900px and shifts the themed root with padding.
31. **Media modifiers are CSS on a frame (ds5).** Image and Video render a
   `.qb-media-frame` inside the figure that carries ratio, corner radius and
   shape (`mask`: circle, arch, squircle, blob, slant or a custom SVG/PNG via
   `--qb-mask-image`). Circle and squircle fall back to 1:1 when the ratio is
   Original. Parallax and scroll reveal are scroll-driven CSS
   (`animation-timeline`) inside `@supports` and a no-preference motion
   query, so unsupported browsers and reduced motion get a still image. Image
   hovers (zoom, lift, grey to colour, shine) only apply under
   `(hover: hover)`; reduced motion keeps colour only. Card gained `hover`
   (lift, the default and the old behaviour, zoom, border). `startMedia` in
   the site runtime plays ambient videos only while on screen and keeps them
   on the poster under reduced motion. Overlay captions sit inside the frame.
32. **Draft theme on preview, live canvas, page settings.** The `/layout` API
   returns the theme draft when the request carries a preview grant
   (`getLiveTheme(siteId, { draft })`); `/theme` and `/theme.css` stay
   published. The studio canvas runs `startCanvasRuntime` through Puck's
   `overrides.iframe`: a MutationObserver keeps one effect canvas per effect
   element (restart on kind change), re-binds menus and ambient video after
   edits, and shows scheduled effects all year. The toolbar clapperboard plays
   the page's overlay transition in the canvas. Pages carry `transition` and
   `effect` on `root.props` (`""` theme, `"none"` off, or a preset id), hidden
   on header/footer groups. A page transition is used when leaving that page;
   the arrival record names the preset, so the runtime ships every transition
   and the arrival script is emitted when any overlay is possible
   (`mayArriveCovered`). A page that overrides a native-crossfade theme emits
   `@view-transition { navigation: none; }`. A page effect ignores the theme
   schedule.
33. **Studio canvas scroll, languages page.** Puck mirrors the host `<body>`
   classes and stylesheets into the canvas iframe, so the studio body must not
   carry overflow or layout classes (an `overflow-hidden` there froze the
   canvas). Host-only rules go in studio.css scoped with `body:has(.studio)`,
   which the iframe body never matches. The canvas hides its native scrollbar
   (style injected into the iframe head) and `CanvasScrollbar` draws a thin
   bar in the gutter beside the card (inset on phones): shown while
   scrolling, hidden after 2s idle, wider on hover, draggable, click to page.
   The gutter is 11px so it fits the smallest canvas padding (p-3). The
   Languages page reads `studio.translationCoverage(siteId)` (done, stale and
   total per non-primary locale) and says plainly that the storefront locale
   switch and Studio translating are not built yet.
34. **Site recycle bin.** `site.deleted_at` / `deleted_by_id` (migration 0018).
   `@qubo/studio` `trash.ts`: `trashSite` (drafts only, guard in the UPDATE),
   `restoreSite`, `purgeSite` (only rows already in the bin, so a bare id can
   never delete a live site), `purgeTrashedSites` (daily from
   `packages/api/src/server.ts`, `TRASH_RETENTION_DAYS` = 60). Every resolver
   filters `deleted_at is null`: API `resolveSite` (slug header and host join),
   admin `getUserSites`, `servedHosts` (edge config) and the portal quota
   counts. Slug and domains stay reserved while in the bin so a restore is
   exact. Gap: a purge cascades the `asset` rows but leaves the files in
   storage. Live sites cannot be deleted yet (needs the typed-name guard).

## Roadmap

- [x] Rename/restructure to `qubo-stack`, push to GitHub
- [x] Zed workspace (`.zed/settings.json`, `.zed/tasks.json`)
- [x] `packages/api` — Elysia on Bun, auth + tenancy middleware
- [x] Multi-storefront seams (`@qubo/storefront`)
- [x] Puck install + `page`/`pageRevision` schema in `qubo-admin`
- [x] Rename `store` → `site` (+ `site.type`), move DB onto Supabase
- [ ] Qubo Studio — Plan A foundation (stylekit, blocks, studio services done; media next)
- [ ] Qubo Studio — Plan B native Studio UI (B1 shell, block library explorer, B2 settings, B4 editor, B5 add-section, B6 theme settings done)
- [x] Generic host-resolved storefront (`apps/qubo-storefront`): SEO, commerce, accounts, maintenance; `apps/hm-froid` deleted
- [x] Panel on `qubo.<domain>`, staff hint cookie + storefront Edit pen
- [x] Version 0.0.2, Changesets, API under `/v1`, `@qubo/protocol` skeleton
- [ ] Rebuild category tree, recover missing products
- [ ] Panel CRUD: products, variants, media, orders
- [ ] Comparison pass against `../../Karima/kyf-moves` (1-year-old panel)
- [x] Self-service custom domains: DNS guide, live verification, Traefik routing
- [ ] Domain/DNS cutover from ShopApplication

## Conventions

Agent guidance lives in `AGENTS.md` (always-on) and `.agents/skills/*/SKILL.md` (loaded on
demand by name). Keep this file for architecture and decisions; put how-to knowledge in a skill.

- Imports: `@/*` is the app root; shared code via `@qubo/db`,
  `@qubo/db/schema`, `@qubo/db/client`, `@qubo/shared`.
- shadcn/ui is installed **per app**, not shared.
- API: public routes live under `/v1` (`API_VERSION` in `@qubo/storefront`);
  `/health`, `/api/auth/*` and `/webhooks/*` stay unversioned.
- Never hardcode hostnames: `siteUrl()` / `adminUrl()` from `@qubo/shared`,
  env `PLATFORM_BASE_DOMAIN`, `ADMIN_SUBDOMAIN`, `PORTAL_URL` (unset = pure self-host).
- Naming: the product is **Qubo**. Packages are `@qubo/*`, apps `qubo-*`, env vars
  `QUBO_*`, CSS classes and custom properties `qb-` / `--qb-` (`CSS_PREFIX` in
  `@qubo/stylekit`). No other prefix or legacy project name may appear in code.
- Every user-facing change gets a changeset (`pnpm changeset`).
- Tailwind v4 CSS-first config (no `tailwind.config.js`); tokens in
  `app/globals.css`.
- Route protection uses `proxy.ts` (Next.js 16 convention, replaces
  `middleware.ts`) — export a named `proxy` function.
- `.private/` holds the legacy archive, customer data and DB backups. It is
  gitignored and must never be committed.

### Branches and PRs (solo mode)

- Work on `ali/<type>-<slug>` (`qd branch new feat my-thing`, from fresh `origin/staging`), open the
  PR with `qd pr` → `staging`. `staging` → `main` releases. `hotfix/<slug>` → `main` (and back to staging).
- `scripts/check-branch-governance.mjs` (CI: `.github/workflows/governance.yml`) enforces the grammar
  and merge direction; `SOLO_MODE=1` (repo variable, default on) allows work → staging without a sprint branch.
- `stale-work.yml` labels PRs idle for 7 days; it never closes anything.
- Owner for `qd branch new` comes from `.qubo/dev.local.json` → `{"owner":"ali"}`.
