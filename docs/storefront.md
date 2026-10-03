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
| `/sitemap.xml` | `GET /render/sitemap`: home, published pages, and with `catalog` the collections and products |
| `/robots.txt` | Blocks everything on dev/preview hosts, otherwise points at the sitemap |
| `<link rel=canonical>` | Primary verified domain + path, query dropped |

- Non-primary verified domains (and `www.<primary>`) 308 to the primary domain, path kept.
- A missing page checks the `redirect` table (legacy URLs) before rendering the `not_found` template.
- Dev (`QUBO_DEV=1`) is always `noindex` and canonical to its own host.

## Caching and publish

API reads go through Next's data cache, tagged `site:<slug>` (and `layouts` for host lookups), TTL 300 s.
Publishing in the admin calls `notifyRevalidate` (`@qubo/studio`), which POSTs `{ site, tags }`
to `QUBO_REVALIDATE_<SLUG>` or `QUBO_REVALIDATE_URL` (this app's `/api/revalidate`), signed with
`QUBO_REVALIDATE_SECRET` (HMAC-SHA256 in `x-qubo-signature`). The site's cache is dropped at once.
`qd` sets both variables in dev (secret in `.qubo/revalidate.secret`).

## Commerce

Sites with the `commerce` capability get a client cart (`localStorage` key `qubo-cart:<siteId>`,
max 10 lines × 20), the `ProductDetail` and `Cart` blocks, and `/checkout/success` (clears the cart).
`/api/checkout` (this app) forwards the cart to qubo-api `POST /checkout` with the visitor's origin;
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

## Maintenance

When `site_settings.maintenance_mode` is on (and `maintenance_end` not passed), every page renders the
site's `maintenance` template, or a built-in notice with `maintenance_message`, with status 200.

## Env

| Var | Purpose |
| --- | --- |
| `QUBO_API_URL` | qubo-api base URL (server-side) |
| `PLATFORM_BASE_DOMAIN` | Platform subdomains, e.g. `dev.by-ali.dev` |
| `STOREFRONT_DEFAULT_SITE` | Fallback site slug for single-site installs |
| `QUBO_ADMIN_HOSTS` | Admin host for `/admin` redirects (default `qubo.<host>`) |
| `QUBO_REVALIDATE_SECRET` | Verifies publish hooks |
| `LEGACY_ASSET_ROOT` | Folder behind `/api/legacy-assets/*` |
