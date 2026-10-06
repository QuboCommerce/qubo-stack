# Issue tracker: local plans

Qubo has no external issue tracker. Work is tracked in three places:

- `docs/plans/<plan>.md`: the plan for a body of work, with a phase table whose `id` column
  names each ticket (for example `ds1-schema`).
- `HANDOFF.md`: the decision log and known gaps. Every merged ticket adds an entry.
- The agent session todo table: live status (`pending`, `in_progress`, `done`, `blocked`) and
  blocking edges, keyed by the same ticket ids.

## When a skill says "publish to the issue tracker"

Add or update the phase table in the relevant `docs/plans/*.md` file. One row per ticket, with
a `Blocked by:` note in the dependency paragraph below the table.

## When a skill says "fetch the relevant ticket"

Read the row for that id in `docs/plans/*.md` and the matching HANDOFF entry, if any.

## Commits and pull requests

Commits reference the ticket id in the body (`ds1-schema`). Merges are `--no-ff` into
`staging`; see the `qubo-branch-workflow` skill.
