---
name: qubo-portal-link
description: How a self-hosted Qubo instance links to the Qubo Portal (registration token, Ed25519 heartbeats, EdDSA licence, entitlements and the single site-count gate). Use when touching @qubo/portal-client, portal_link, Settings → Qubo Portal, site quotas or plan limits.
---

# Portal link and entitlements

Philosophy (decided): a self-hosted instance is **fully usable without the Portal**. The only
product gate is *more than one site per instance*, which needs a linked account on Growth+.
Entitlements only gate **creation**; storefronts and existing sites never degrade or lock.

## Pieces

- `@qubo/protocol` — wire types shared with the portal repo (`FREE_LIMITS`, request/response
  schemas, `SIGNATURE_HEADERS`). Edit in **both** repos (`scripts/sync-protocol.mjs` in the portal).
- `@qubo/portal-client` (`packages/portal-client`) — instance side. One row in `portal_link`
  (migration 0010): portal URL, instance id, Ed25519 keypair (JWK), cached licence JWS + claims,
  last heartbeat/error. API: `link`, `unlink`, `heartbeat`, `entitlements`, `entitlementsFor`,
  `siteQuota`, `startHeartbeatLoop`.
- API (`packages/api/src/server.ts`) calls `startHeartbeatLoop()` after listen: every 6 h, no-op
  while unlinked, failures are recorded in `portal_link.last_error` and never thrown.
- Admin: Settings → Organization → **Qubo Portal** (`settings/portal/page.tsx`, `app/portal-actions.ts`,
  `components/settings/portal-link-form.tsx`). Sites page shows `siteQuota` and disables "Create site".

## Flow

1. Portal user creates a one-time **registration token** (Instances → Add). Stored hashed, 1 h TTL.
2. Admin pastes it → `link()` generates an Ed25519 keypair, `POST /v1/instances/register`
   `{token, name, publicKey(base64url raw, 43 chars), appVersion, channel}` → `{instanceId, jwksUrl, licenseToken?}`.
3. `heartbeat()` signs `qubo-v1.<ts>.<rawBody>` with the private key; headers from `SIGNATURE_HEADERS`.
   Response carries a fresh `licenseToken` (EdDSA JWS, 30 d TTL, 7 d grace) verified against the
   portal JWKS before caching.
4. `entitlementsFor(link, now)` → `source: unlinked | licence | grace | expired`; `grace` keeps plan
   limits, `expired`/`unlinked` fall back to `FREE_LIMITS`. Never below Free.

## Testing locally

Run the portal API on a spare port (`cd qubo-portal/packages/api && PORT=4999 … bun src/server.ts`),
insert a `registration_token` (sha256 hex of the raw token) for a dev org, optionally
`insert into license(organization_id, plan) values (…, 'growth')`, then exercise
`link({ portalUrl: "http://127.0.0.1:4999", … })`. `unset PORTAL_API_URL` first or `apiOf()` is bypassed.
Unit tests: `pnpm --filter @qubo/portal-client test`.
