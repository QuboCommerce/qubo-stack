---
name: qubo-hosts-and-urls
description: Host and URL model for Qubo (customer domains, admin subdomain, dev hosts, portal hosts, URL helpers and env vars). Use for anything that builds a link, resolves a request host or touches DNS/edge routing.
---

# Hosts and URLs

Never hardcode a hostname. Build links with `siteUrl()` / `adminUrl()` from `@qubo/shared`,
resolve requests with `requestHost()` in the storefront.

## Production (per customer instance)

| Host | Serves |
| --- | --- |
| `<verified domain>` | storefront for that site |
| `qubo.<verified domain>` | admin (`ADMIN_SUBDOMAIN`, default `qubo`) |
| `<slug>.<PLATFORM_BASE_DOMAIN>` | storefront fallback before a domain is verified |

Edge: Traefik in `~/infra` (repo `octopus-dx`) with one dynamic file per host group.

## Control plane (separate machine, repo `qubo-portal`)

`qubo.by-ali.dev` marketing, `portal.qubo.by-ali.dev` portal, `api.portal.qubo.by-ali.dev`
API, `db.portal.qubo.by-ali.dev` Studio behind auth. Instances know only `PORTAL_URL`.

## Dev (this box, project-agnostic)

`dev.by-ali.dev` slot 1, `<site>.dev.by-ali.dev` slot 2, `api.dev.by-ali.dev` slot 3,
`db.dev.by-ali.dev` Studio. DNS: `dev` and `*.dev` CNAME to `qntr.by-ali.dev` (DDNS).
TLS-ALPN cannot issue wildcards, so each site host used in dev needs an explicit router in
`~/infra/edge/dynamic/dev.yml`.

## Resolution order in the storefront (`apps/qubo-storefront/lib/site.ts`)

1. `QUBO_DEV_SITE_HOSTS` map (laptop mode).
2. `<slug>.<PLATFORM_BASE_DOMAIN>`.
3. Verified `site_domain` via the API (`x-forwarded-host`).
4. `STOREFRONT_DEFAULT_SITE`.

Dev hosts and `QUBO_DEV=1` render with `noindex`.

## Env vars that carry URLs

`QUBO_API_URL` (server to server, loopback or container name), `QUBO_TRUSTED_ORIGINS`,
`QUBO_ADMIN_HOSTS` (dev override), `PLATFORM_BASE_DOMAIN`, `BETTER_AUTH_URL`,
`QUBO_REVALIDATE_URL`/`_SECRET`, `PORTAL_URL`. `qd` injects all of these from
`dev.config.json`; `docker-compose.yml` sets them in prod. Avoid `NEXT_PUBLIC_*` for URLs:
it bakes the domain into the image.
