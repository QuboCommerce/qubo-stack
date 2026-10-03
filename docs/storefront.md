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

## Env

| Var | Purpose |
| --- | --- |
| `QUBO_API_URL` | qubo-api base URL (server-side) |
| `PLATFORM_BASE_DOMAIN` | Platform subdomains, e.g. `dev.by-ali.dev` |
| `STOREFRONT_DEFAULT_SITE` | Fallback site slug for single-site installs |
| `QUBO_ADMIN_HOSTS` | Admin host for `/admin` redirects (default `qubo.<host>`) |
| `QUBO_REVALIDATE_SECRET` | Verifies publish hooks |
| `LEGACY_ASSET_ROOT` | Folder behind `/api/legacy-assets/*` |
