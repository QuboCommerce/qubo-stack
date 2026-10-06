---
"@qubo/domains": minor
"@qubo/api": minor
"@qubo/db": minor
"qubo-admin": minor
---

Self-service custom domains. Settings → Domains now connects a domain and shows the exact DNS records to add, with the detected DNS provider, copy buttons and a live status per record that flags wrong values, Cloudflare proxying and stray IPv6 records. The API re-checks DNS on a schedule and verifies the domain once its records hold; the page updates by itself. A login-free setup link can be sent to whoever manages the DNS. Verified domains, their `qubo.`, `preview.` and `www.` hosts are served automatically: Traefik polls `GET /v1/edge/traefik` for routes and certificates. The static Caddy edge is removed.
