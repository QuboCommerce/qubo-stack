---
"@qubo/realtime": minor
"@qubo/db": minor
"qubo-admin": minor
---

Platform event bus: `platform_event` outbox table + LISTEN/NOTIFY, SSE with Last-Event-ID resume and polling fallback (`/api/events`), admin actions emit `entity.updated` / `document.published` / `theme.published`, and product/order/dashboard lists refresh live on other users' changes.
