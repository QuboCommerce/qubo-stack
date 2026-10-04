---
name: qubo-branch-workflow
description: How a unit of work goes from branch to staging in qubo-stack (branch grammar, gates, changeset, HANDOFF decision, no-ff merge, PR rules). Use when starting or finishing a task.
---

# Branch workflow

Solo mode: work branches merge straight into `staging`; `staging` to `main` is a release.
Governance is enforced by `scripts/check-branch-governance.mjs` (CI: `.github/workflows/governance.yml`).

## Start

```sh
qd branch new <type> <slug>      # -> <owner>/<type>-<slug> from fresh origin/staging
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`. Owner comes from `.qubo/dev.local.json`.

## Finish (all of these, in order)

1. Gates: `npx tsc --noEmit -p .` in every touched app (`apps/qubo-admin` has no ESLint);
   `bun test` in touched packages; curl or Playwright against the running `qd` service.
2. Changeset in `.changeset/<slug>.md`: bump every touched package, one paragraph a
   merchant could read.
3. If a decision was made, append a numbered entry under **Key decisions** in `HANDOFF.md`
   and update **Known gaps** if one was closed or opened.
4. Commit with the `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`
   trailer when an agent wrote it.
5. Merge: `git checkout staging && git merge --no-ff <branch> && git push origin staging`.
   `qd pr` opens a PR instead when a review is wanted; the PAT in this environment cannot
   create PRs, so merging locally is the default.
6. Mark the task done in whatever tracker the session uses.

## Hotfix

`hotfix/<slug>` from `main`, merge into `main`, then merge `main` back into `staging`.

## Never

- Commit `.private/`, `.qubo/`, `.env`.
- Force-push `staging` or `main`.
- Leave a branch merged but unpushed.
