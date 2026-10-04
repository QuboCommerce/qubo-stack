---
"@qubo/protocol": minor
"@qubo/portal-client": minor
"qubo-admin": minor
"@qubo/api": minor
"@qubo/db": minor
---

Pooled plan limits and the organisation lock. Licences now carry `orgs` and `sites` counted across the whole instance (any split between organisations) instead of sites per organisation. `access()` in `@qubo/portal-client` licenses the oldest organisations and sites first; everything else is locked in the back office only: the admin redirects to `/locked` from `requireSite` (pages, layouts and server actions), realtime/lease routes drop locked sites from the viewer's audience, and the API answers `402 site_locked`. Storefronts are never locked. The site switcher groups sites by organisation and marks locked ones. Organisations gain legal-entity fields (migration 0011); `scripts/data/split-mostapha-orgs.sql` moves TailG into its own organisation. `getPreviewPin` is no longer exported as a server action.
