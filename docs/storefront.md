# qubo-storefront

One Next.js app serves every site of the instance, chosen by the request host.

## Host resolution (`lib/site.ts`)

`proxy.ts` rewrites every request to `/sites/<host>/<path>` and sets `x-qubo-host` / `x-qubo-path`.
The site is then resolved in this order:

1. `QUBO_DEV_SITE_HOSTS` (`host=slug,…`, local dev)
2. `<slug>.<PLATFORM_BASE_DOMAIN>` (dev: `hm-froid.dev.by-ali.dev`)
3. `site_domain.hostname` via the API
4. `STOREFRONT_DEFAULT_SITE` (single-site installs)

`qubo.*` hosts 404 (admin), `/admin` redirects to the admin host.

## SEO

| Route | Source |
| --- | --- |
| `/sitemap.xml` | `GET /v1/render/sitemap`: home, published pages (with titles), and with `catalog` the collections and products |
| `/robots.txt` | Blocks everything on dev/preview hosts, otherwise points at the sitemap |
| `<link rel=canonical>` | Primary verified domain + path, query dropped |
| `<title>` | `<page> \| <site title>`; the site title is Settings > Business & SEO (else the site name). The home page carries its Studio title or the site title alone |
| `<meta name=description>` | Page or product description, else the site description from Business & SEO, else General |
| JSON-LD | `lib/seo.tsx`. Every page: `Organization`, `WebSite` and, once an address is set, the business (`LocalBusiness` or the chosen subtype) with phone, hours and geo. Products: `Product` with `Offer` / `AggregateOffer`. Products, collections and pages: `BreadcrumbList` |

- Non-primary verified domains (and `www.<primary>`) 308 to the primary domain, path kept.
- A missing page checks the `redirect` table (legacy URLs) before rendering the `not_found` template.
- Dev (`QUBO_DEV=1`) is always `noindex` and canonical to its own host.
- The `SiteTree` block (`/plan-du-site` blueprint) is filled by `loadBlockData` from the same sitemap plus the category tree, so a human-readable site map never drifts from the XML one.
- `CollectionHeader` is filled the same way: breadcrumb (parent chain from home), description, product count of the whole subtree, and the child shelves. `/collections/all` uses its `allTitle`.
- `SteelReveal` is a CSS-only scroll-driven hero (two steel doors open on `animation-timeline: view()`); it degrades to its open state without scroll timelines or under reduced motion. Sticky headers publish `--qb-header-h` so pinned sections start below them.
- `/v1/catalog/products?category=` returns the subtree, since imported products hang on leaf categories.
- Imported names are shown through `tidyName` (`lib/names.ts`): all-caps categories and lowercase product names become sentence case in titles, cards, breadcrumbs and JSON-LD. Mixed case is left alone.
- Structured data only repeats what the merchant typed in Settings > Business & SEO and the
  organisation record (legal name, numbers, address): a missing field is left out, never guessed.

## Languages

Only the language part of a locale shows in URLs. The primary language lives at the root; every
other published `site_locale` is served under `/<lang>` (`/nl/...`). The proxy strips the prefix
(`splitLocalePath` from `@qubo/shared/locale-url`), rewrites to `/sites/<host>/<rest>` and passes
the locale as `x-qubo-lang`; `getStorefront` turns it into `sf.locale`, `sf.basePath` and
`sf.locales`. `/fr/...` on a French-primary site 308s to the root; an unknown prefix is a 404.

| What | Where it is translated |
| --- | --- |
| Block text, richtext, media alt | `translation` rows `document:<id>`, path `<nodeId>.<field>`; the document root title is `root.title` |
| Page title, meta title, meta description, slug | `translation` rows `page:<id>`, written by `upsertPageTranslations` (slugs must be unique per locale) |
| Site meta title and description | `translation` rows `site:<id>`, `upsertSiteTranslations` |
| Catalogue names and descriptions | not yet; `/collections` and `/products` paths are shared across languages |

- Secondary-language pages are reached by their translated slug (`/nl/levering-en-betaling`);
  the primary slug under a prefix 308s to it. A translated title wins over an untranslated meta title.
- `RenderMetadata.basePath` is `""` for the primary language and `/<lang>` otherwise (it was `/`,
  which turned local links into protocol-relative `//path` URLs). `localHref` maps `/#id` to
  `<base>#id` so home anchors work in every language.
- `RenderMetadata.basePath` and `localHref` prefix every link a block builds (`resolveLink`,
  header brand, search, account, cart). `metadata.links` maps `page:<slug>` to the localized path.
- `<html lang>`, `og:locale`, `BreadcrumbList` and `inLanguage` follow `sf.locale`; `<head>`
  carries `hreflang` for every served language plus `x-default` (the primary); the sitemap
  repeats them as `xhtml:link`; robots blocks `/<lang>/cart`, `/account`, `/search` per language.
- `SiteHeader` renders a `FR | NL` switch (`languageSwitch` field, `.qb-site-lang`) that points
  at the same page in each language.
- Two-letter page slugs at the root are shadowed by the prefix (`/nl` is a language, never a page).
- `scripts/sites/hm-froid.ts` writes the Dutch overlay from `hm-froid.nl.ts` after each publish by
  matching the French text; the Studio has no UI for page-level and site-level translations yet.

## Caching and publish

API reads go through Next's data cache, tagged `site:<slug>` (and `layouts` for host lookups), TTL 300 s.
Publishing in the admin calls `notifyRevalidate` (`@qubo/studio`), which POSTs `{ site, tags }`
to `QUBO_REVALIDATE_<SLUG>` or `QUBO_REVALIDATE_URL` (this app's `/api/revalidate`), signed with
`QUBO_REVALIDATE_SECRET` (HMAC-SHA256 in `x-qubo-signature`). The site's cache is dropped at once.
`qd` sets both variables in dev (secret in `.qubo/revalidate.secret`).

## Commerce

Sites with the `commerce` capability get a client cart (`localStorage` key `qubo-cart:<siteId>`,
max 10 lines × 20), the `ProductDetail` and `Cart` blocks, and `/checkout/success` (clears the cart).
`/api/checkout` (this app) forwards the cart to qubo-api `POST /v1/checkout` with the visitor's origin;
the API re-prices every line, only accepts origins on the platform domain, verified site domains or
`QUBO_DEV_SITE_HOSTS`, and creates a Stripe Checkout Session. `POST /webhooks/stripe` records the
paid order (idempotent per session), decrements stock and emails the customer via Resend.
Without `STRIPE_SECRET_KEY` checkout answers 503 and the cart shows its error label.

Webhook endpoint: `https://api.<base>/webhooks/stripe`, events `checkout.session.completed`
and `checkout.session.async_payment_succeeded`.

| API var | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe API key and webhook signing secret |
| `CHECKOUT_COUNTRIES` | Shipping countries (default `BE,FR,LU,NL`) |
| `CHECKOUT_AUTOMATIC_TAX` | `0` disables Stripe Tax |
| `CHECKOUT_SHIPPING_CENTS` / `CHECKOUT_SHIPPING_LABEL` | Optional flat shipping rate |
| `RESEND_API_KEY` / `ORDER_EMAIL_FROM` | Order confirmation email |
| `EMAIL_FROM` | Sender for inbox replies and form notifications (falls back to `ORDER_EMAIL_FROM`) |
| `EMAIL_INBOUND_DOMAIN` / `RESEND_WEBHOOK_SECRET` | Inbound e-mail into the inbox (see Forms, chat and e-mail) |

## Customer accounts

Sites with the `accounts` capability proxy `/api/auth/*` to qubo-api's Better Auth (one identity
across the platform) and serve `/api/account` (profile + this site's orders). The proxy forwards
`x-qubo-site` and `x-forwarded-host/proto`, so session cookies are `__Secure-`, HttpOnly and
**host-only on the site's own domain**; the API trusts a request origin only if it serves that site.
The `Account` block renders sign-in / create-account, then profile and orders. Orders are linked
by `customer_id` (Stripe `client_reference_id` at checkout), never by email, because sign-up does
not verify email yet. First visit registers a `site_customer` row. Password reset needs an email
sender and is not wired yet.

## Admin host and the Edit pen

The panel lives at `qubo.<site domain>` (`ADMIN_SUBDOMAIN`, dev override `QUBO_ADMIN_HOSTS`);
build its URLs with `@qubo/shared/admin-url`, never by hand. The edge (Traefik, fed by `/v1/edge/traefik`) sends `qubo.*` to qubo-admin;
the storefront 404s on them and 302s `/admin*` to the panel. The panel opens the site of its host
(`qubo.hmfroid.be` → HM Froid), trusts `https://qubo.<verified domain>` origins dynamically, sends
`X-Robots-Tag: noindex` + a disallow-all `robots.txt`, and serves a per-site web-app manifest.

- **Admin session:** `__Secure-qubo-admin.session_token`, HttpOnly, **host-only** on the panel host
  (Better Auth only reads `__Secure-`, so no `__Host-` prefix). Never on the parent domain.
- **`qubo_staff` hint:** after sign-in the panel sets `qubo_staff=<siteId>.<siteId>` on the
  registrable parent domain (`tldts`), cleared on sign-out. It grants nothing.
- **Edit pen:** `RenderView` mounts `StaffBar` (client). When the hint names this site it calls
  `GET <panel>/api/me` with credentials (CORS: exact verified-domain origins; dev site hosts in dev)
  and only then shows Edit page (`/<slug>/studio?doc=<documentId>`) · Theme · Dashboard, dismissible
  per session. Pages stay fully cached; guests never see it.
- **Open Qubo:** `/api/account` adds `panelUrl` (panel sign-in, e-mail prefilled) for staff of the
  site; the Account block shows it as a button. One-time handoff tokens replace this in Phase 2.

## Forms, chat and e-mail

- **Forms:** every form block posts to `/api/forms/:key` (JSON, urlencoded or multipart; no-JS posts
  get a 303 back with `?form_status=sent|error`). It forwards to `POST /v1/forms/:key` with a signed
  visitor IP for rate limiting. Submissions open inbox conversations.
- **Chat** (`ChatLauncher` block, "Live chat"; requires `leads`): `/api/chat` (thread),
  `/api/chat/messages` (send) and `/api/chat/stream` (SSE of staff replies) proxy to `/v1/chat*`.
  Anonymous visitors are identified by the httpOnly `qb_chat` cookie (minted on the first message,
  path `/api/chat`, 180 days; only its sha256 is stored), signed-in customers by their session; an
  anonymous chat is claimed by the customer who signs in on that browser. Visitors only ever see
  public messages. Put the block in the footer layout to show it on every page. Visitors can attach
  up to 3 images or PDFs (10 MB each) per message unless the block's "Visitors can send files" is
  off; the send is then multipart, and `/api/chat/files/<id>` streams a file back only to the
  visitor whose chat it's in. Visitor files are deleted after 30 days unless staff keep them.
- **E-mail in:** Resend receives mail on `EMAIL_INBOUND_DOMAIN` and calls
  `POST https://api.<base>/webhooks/resend` (event `email.received`, signed with
  `RESEND_WEBHOOK_SECRET`). Mail to `<site-slug>@<domain>` opens an `email` conversation, so a
  shop's own mailbox can forward there. Staff replies carry `Reply-To: reply+<conversationId>@<domain>`
  and a `<messageId@sender-domain>` Message-ID, so answers thread back by address, by
  In-Reply-To/References, or as a last resort by sender plus subject (open threads, 30 days).
  Quoted history is stripped from replies. Auto-replies, DMARC failures, our own sender and
  duplicates (Message-ID) are dropped; 30 mails per sender per site per hour. Attachments are
  imported into private storage (up to 10 per mail, inbox file types only); the rest are listed by
  name in the message. Needs file storage (`STORAGE_DIR` or `STORAGE_ENDPOINT`) on the API.

## Media

`/api/media/<org>/<asset>.<ext>` serves media-library files straight from storage (`@qubo/storage`
`serveMedia`), so block and product image URLs are relative and work on every host of a site. Files
are immutable (a new upload gets a new id) and cached for a year.

## Section kits

A section kit is a family of blocks that carries its own CSS, icons and behaviour, for a design
that the generic library cannot express. The first is `chapters` (HM Froid "Cobalt Chapters", a
port of a hand-made landing page). Files live in `packages/blocks/src/library/kits/<kit>/`.

- **Turned on per theme.** `theme.kits` lists `{ id, assets }`; `assets` maps names used by the
  kit CSS (`inox-grain`) to media ids. `ThemeStyles` emits the kit CSS only when the theme lists
  the kit, and the Studio's Add section dialog hides kit blocks otherwise (`def.kit`,
  `sectionCatalog(registry, capabilities, kits)`).
- **CSS is ported, not hand-written.** `node scripts/kits/port-css.mjs scripts/kits/<kit>.port.mjs
  <source.css>` prefixes every class with `qb-<short>-`, scopes it under `[data-kit="<kit>"]`,
  maps the source palette and fonts to theme tokens, appends `overrides.css` and writes
  `styles.ts`. Edit `overrides.css` or the port config, never `styles.ts`; regenerate after.
- **Markup mirrors the source DOM** so the ported CSS applies unchanged; every visible string,
  link and image is a Puck field. Text used in an attribute (`aria-label`, `data-*`) is
  `inline: false`.
- **Behaviour** (menu, carousel, partner drift, reveals, parallax) is `runtime/<kit>.ts`, started
  by `runtime/site.ts` only when the page holds a kit section. It does not run in the Studio, so
  reveals stay visible there and Puck's inline-text span is reset in `overrides.css`.
- **Theme fonts.** A theme with a kit loads every weight its Google fonts declare, because kit CSS
  picks weights outside the type roles (`googleFontsUrl`).
- **Arrows are icons.** The source's text glyphs (↗ ← → ↑) are lucide arrows (`ArrowIcon` in
  `shared.tsx`, class `qb-ch-arrow-icon`, 1em), kept inside the original spans so the source's
  colour and hover rules still apply.
- **No sideways overflow.** Every kit section clips `overflow-x`, because reveal offsets
  (`translate3d(23px,...)`) widened the page on phones, in the source too.
- **Hero texture** (`ChapterHero.texture`: faint, visible, strong) sets `data-ch-texture`, which
  tunes the grain opacity and the paper wash in `overrides.css`. "faint" is the source; the wash
  keeps its angle so the headline stays readable.
- Known costs: the kit CSS is about 109 KB inline per page that uses it; the source's WebGL metal
  shader is not ported (`[data-ch-steel]` is parallax only).

## Maintenance

When `site_settings.maintenance_mode` is on (and `maintenance_end` not passed), every page renders the
site's `maintenance` template, or a built-in notice with `maintenance_message`, with status 200.

## Env

| Var | Purpose |
| --- | --- |
| `QUBO_API_URL` | qubo-api base URL (server-side) |
| `PLATFORM_BASE_DOMAIN` | Platform subdomains, e.g. `dev.by-ali.dev` |
| `STOREFRONT_DEFAULT_SITE` | Fallback site slug for single-site installs |
| `QUBO_ADMIN_HOSTS` | Dev admin host override (default `qubo.<host>`) |
| `ADMIN_SUBDOMAIN` | Admin host prefix (default `qubo`) |
| `QUBO_REVALIDATE_SECRET` | Verifies publish hooks |
| `STORAGE_DIR` / `STORAGE_ENDPOINT`… | Media files: local folder, or an S3-compatible bucket (see `.env.example`) |
| `LEGACY_ASSET_ROOT` | Folder behind `/api/legacy-assets/*` |
