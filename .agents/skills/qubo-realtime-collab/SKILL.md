---
name: qubo-realtime-collab
description: The realtime layer of the Qubo admin (event bus, presence, device sessions, form three-way merge, Studio edit lease and live follow). Use when changing anything users see update live or when two people edit the same thing.
---

# Realtime and collaboration

All of it is per-process and in memory on top of Postgres `platform_event`; fine for one VPS,
revisit before multi-instance.

## Pieces

| Piece | Where | Notes |
| --- | --- | --- |
| Event catalogue | `packages/realtime/src/index.ts` | typed events; `EPHEMERAL_TYPES` are not persisted |
| Server bus | `packages/realtime/src/server.ts` | SSE fan-out |
| Client | `apps/qubo-admin/components/live-events.tsx` | `LiveEvents`, `ViewerContext`, `useViewer()` |
| Presence | `components/presence.tsx`, `app/api/presence/route.ts` | avatars in top bar, rows, fields, Studio blocks |
| Sessions and takeover | `lib/sessions.ts`, `@qubo/geo` | one active device, prompt before kicking |
| Form merge | `lib/merge.ts`, `lib/merge-server.ts`, `lib/form-specs.ts`, `components/settings/merge-sheet.tsx` | base snapshot three-way merge, CAS on `updatedAt` |
| Studio lease | `lib/lease.ts`, `lib/live-docs.ts`, `app/api/studio/{lease,live}/route.ts`, `components/studio/use-studio-lease.ts` | one editor per document, followers get live patches |

## Rules

- Add an event type to the catalogue first; name it `<entity>.<verb>` in past tense.
- Persist only what a reconnecting client must replay; everything else goes in `EPHEMERAL_TYPES`.
- Forms: new editable form = add a `*Values`/`*Spec` pair in `form-specs.ts`, call
  `reconcile()` in the action, pass `base`, `watch`, `noun` to `SettingsForm`.
- Studio: gate Puck `onChange` by role; followers apply remote data with
  `dispatch({type:"setData"})`, which re-fires `onChange`, hence the gate.
- Lease TTL 30 s, idle 60 s; `request` is granted immediately when the holder is idle,
  expired or the same user.
- Theme drafts still use the version CAS of `useThemeEditor` (no lease yet).

## Verifying

Two Playwright contexts (see `qubo-e2e-testing`). The agreed scenarios are listed in
HANDOFF decisions 18 to 20; rerun the relevant one.
