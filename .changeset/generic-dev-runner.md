---
"qubo-admin": patch
---

Internal: the `qd` dev runner no longer knows anything about this project's services. Project env moved into `dev.config.json` (`env`, `envLocal`, `envRemote`, with `{sitesBaseDomain}` and `{devSiteSlug}` templates), so the same runner file is shared verbatim with qubo-portal.
