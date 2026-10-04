---
name: qubo-naming
description: Naming conventions for the Qubo codebase (packages, apps, env vars, CSS prefix, files). Use before introducing any new identifier and when auditing for legacy names.
---

# Qubo naming

The product is **Qubo**. Earlier working names existed; none may survive in code, config,
docs or stored data.

| Thing | Convention | Example |
| --- | --- | --- |
| Workspace packages | `@qubo/<name>` | `@qubo/stylekit`, `@qubo/realtime` |
| Apps | `qubo-<name>` (folder and package name) | `apps/qubo-storefront` |
| Env vars | `QUBO_*` for Qubo-specific, plain names for third-party | `QUBO_API_URL`, `BETTER_AUTH_URL` |
| CSS classes and custom properties | `qb-` / `--qb-` via `CSS_PREFIX` in `@qubo/stylekit` | `.qb-prose`, `--qb-gap-md` |
| Globals on `globalThis` | `__qubo<Thing>` | `__quboLive` |
| Cookies | `qubo-admin.*` (Better Auth prefix) | `__Secure-qubo-admin.session_token` |
| Request headers | `x-qubo-*` | `x-qubo-host`, `x-qubo-signature` |
| Dev runner | `qd`, session `qubo`, state in `.qubo/` | |
| Branches | `<owner>/<type>-<slug>` from `staging` | `ali/feat-studio-collab` |
| DB tables | singular snake_case, no prefix | `studio_lease`, `site_domain` |

Site slugs (`hm-froid`, `tailg`) are customer data, not project names; they belong in seeds,
dev config and tests only.

## Audit command

```sh
git ls-files | grep -vE 'CHANGELOG|HANDOFF|.changeset' \
  | xargs grep -InE -i 'peltier|\bpltr\b|\bpk-|--pk-|"pk"' 2>/dev/null
```

Must print nothing. If a rename touches CSS, also check stored Puck JSON:
`select count(*) from document where draft_data::text like '%pk-%'`.

## Why `qb-` and not `qubo-`

Block class names repeat thousands of times per page; two characters keep HTML small while
staying unambiguous. `CSS_PREFIX` is the single source: never type the prefix by hand in a
block, call `cx()`/`gap()`/`typeSize()` from `packages/blocks/src/library/shared.tsx`.
