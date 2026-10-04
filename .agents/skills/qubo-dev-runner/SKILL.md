---
name: qubo-dev-runner
description: Operating the qd dev runner (ports, hosts, env injection, screen session, logs, restart, doctor) and known Next/Turbopack/screen pitfalls. Use when a dev service must be started, restarted, inspected or is misbehaving.
---

# qd, the dev runner

`scripts/dev/qd.mjs` (shim: `scripts/dev/qd`). Config: `dev.config.json`; per-machine
overrides: `.qubo/dev.local.json` (gitignored). The runner is project-agnostic: the same
file is vendored into `qubo-portal` unchanged. Project env lives in config
(`env` / `envLocal` / `envRemote`, top level or per service) with templates
`{url:svc}`, `{internal:svc}`, `{port:svc}`, `{host:svc}`, `{secret:name}`,
`{sitesBaseDomain}`, `{devSiteSlug}`.

## Ports and hosts

Ports are `<devDigit>0<slot>0`; Ali is digit 4. Slots are the same for every project on the
dev box, so the edge routes never change:

| Slot | Port | Host | qubo-stack | qubo-portal |
| --- | --- | --- | --- | --- |
| 1 | 4010 | `dev.by-ali.dev` | admin | portal |
| 2 | 4020 | `<site>.dev.by-ali.dev` | storefront (all sites) | marketing (`www`) |
| 3 | 4030 | `api.dev.by-ali.dev` | api | api |

Only one project owns the slots at a time: `qd down` in the other repo first.
Supabase Studio is `db.dev.by-ali.dev` (basic auth at the edge).

## Commands

```sh
qd up            # preflight + start all (screen session "qubo", detached)
qd status        # ports, health, public URLs
qd restart web   # respawn one window in place (use: timeout 60 node scripts/dev/qd.mjs restart web)
qd logs admin -f # .private/dev/logs/<svc>.log
qd env api       # exactly what qd injects
qd doctor        # every check with its fix
qd down          # close the session
```

## Pitfalls

- `screen -Q` / `screen -ls` can block forever. Every call has a 5 s timeout; if the hub
  runs old code, kill its PID and send `r` to the hub window.
- Storefront must run `next dev --hostname localhost`, not `127.0.0.1`: Next builds proxy
  URLs as `localhost:<port>` and only treats same-host rewrites as internal when they match.
- Turbopack panic or stale chunks: `rm -rf apps/<app>/.next` then restart.
- Hairpin NAT: test public hosts with `curl --resolve host:443:127.0.0.1 https://host/`.
- Logs show "Rate limiting could not determine a client IP" when hitting a service directly
  instead of through the edge; harmless in dev.
