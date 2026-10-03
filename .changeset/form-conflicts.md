---
"qubo-admin": minor
"@qubo/db": patch
---

Forms never lose work when two people edit the same product, category or site settings. A clean form reloads in place when someone else saves. A form with unsaved edits shows a banner with a Review button. Saving merges automatically, and when both people changed the same field a merge sheet asks which version to keep for that field. Also fixes a database connection leak in development (one pool per process, idle connections close).
