---
"@qubo/inbox": minor
"@qubo/api": minor
"@qubo/db": minor
"@qubo/realtime": minor
"@qubo/shared": minor
"@qubo/storefront": minor
"@qubo/blocks": minor
"qubo-admin": minor
"qubo-storefront": minor
---

Inbox: forms on the storefront now open conversations in a new three-pane admin inbox with replies by e-mail, internal notes, status, priority, assignee and live unread badges. Adds `@qubo/inbox`, the `conversation`/`message` schema, `POST /v1/forms/:key` with honeypot and rate limits, and fixes realtime publish payloads being double encoded.
