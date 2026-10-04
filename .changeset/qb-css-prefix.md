---
"@qubo/stylekit": minor
"@qubo/blocks": minor
"qubo-admin": patch
---

Theme CSS custom properties and block class names now use the `qb-` prefix (`--qb-gap-md`, `.qb-prose`) instead of the pre-rename `pk-`. No stored Puck data contained the old prefix, so nothing needs migrating.
