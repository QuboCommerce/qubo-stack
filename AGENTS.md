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
