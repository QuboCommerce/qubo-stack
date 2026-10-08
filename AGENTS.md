# Qubo (qubo-stack)

Qubo is a self-hosted multi-site CMS, site builder and back office. This monorepo holds the
product that runs on a customer's server: `apps/qubo-admin` (Next 16), `apps/qubo-storefront`
(Next 16, renders every site by host), `packages/api` (Elysia on Bun) and the `@qubo/*`
packages. The control plane lives in the separate `qubo-portal` repo.

Read `HANDOFF.md` once per task for architecture, key decisions and known gaps. Do not read
every skill: load the one that matches the job.

## Hard rules

- Naming is **Qubo** everywhere: packages `@qubo/*`, apps `qubo-*`, env `QUBO_*`, CSS `qb-` /
  `--qb-`. No other prefix, abbreviation or earlier project name may appear. See `qubo-naming`.
- Never hardcode a hostname or port. URLs come from `@qubo/shared` helpers and env.
- Work on a branch from `staging`, verify end to end, add a changeset and a HANDOFF entry,
  merge `--no-ff`. See `qubo-branch-workflow`.
- `.private/` is customer data. Never commit it, never paste it into docs.
- Gates before a merge: `tsc --noEmit` in every touched app, `bun test` in touched packages,
  and a real request against the running dev service.
- Prose: no em-dashes in docs, comments or changesets.
- Scratch files (ad hoc scripts, screenshots, dumps, logs) go in `.scratch/` at the repo root
  (gitignored), never in `/tmp` or anywhere else outside the repo. The editor adds every outside
  file an agent opens as a project folder, and it rescans them, which runs the box out of memory.

## Skills (`.agents/skills/`)

Load by name when the task matches the description.

| Skill | Use when |
| --- | --- |
| `qubo-naming` | adding any identifier, class, env var, package or file |
| `qubo-branch-workflow` | starting, finishing or shipping a piece of work |
| `qubo-dev-runner` | starting, restarting, inspecting or debugging dev services (`qd`) |
| `qubo-database` | schema changes, migrations, psql, concurrency and timestamps |
| `qubo-e2e-testing` | verifying UI with Playwright, multi-user flows, session cookies |
| `qubo-hosts-and-urls` | anything touching domains, admin hosts, dev hosts or links |
| `qubo-realtime-collab` | presence, live events, Studio leases, form merges |
| `qubo-storefront-rendering` | Puck documents, templates, blocks, theme, SEO on the storefront |
| `qubo-portal-link` | Portal link, licence/entitlements, site quota, `@qubo/portal-client` |
| `qubo-design-language` | designing a site, adding a block, field or any visual feature |

Vendored general skills (MIT, upstream noted in each folder):

| Skill | Use when |
| --- | --- |
| `landing-page-design` | planning or writing a site page: structure, copy, proof, SEO intent |
| `humanizer` | any prose a visitor or customer reads |
| `grill-me`, `grilling` | being interviewed about a plan until every branch is resolved |
| `tdd` | building a feature or fix test first |
| `diagnosing-bugs` | hard bugs and performance regressions |
| `code-review` | reviewing a branch diff before merge |
| `pr` | writing a pull request or merge summary |
| `codebase-design`, `improve-codebase-architecture`, `domain-modeling` | module design, deepening surveys, glossary and ADRs |
| `to-tickets` | breaking a plan into tickets with blocking edges |
| `handoff` | compacting a session for the next agent |
| `writing-for-agents` | writing skills, AGENTS.md or docs an agent reads |
| `prototype` | a throwaway prototype to answer a design question |

Customer VPS setup (users, SSH, firewall, Coolify): `docs/VPS.md`.
Plans: `docs/plans/`.

## Agent skills

### Issue tracker

Local: plans in `docs/plans/`, decisions in `HANDOFF.md`. See `docs/agents/issue-tracker.md`.

### Domain docs

Single context: `GLOSSARY.md` and `docs/adr/` at the root, created lazily. See `docs/agents/domain.md`.
