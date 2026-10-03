/**
 * @qubo/protocol — the wire contract between a Qubo instance, the Portal and
 * Cubicles (third-party apps). Schemas only: no I/O, no secrets, safe to import
 * anywhere. Bump PROTOCOL_VERSION on breaking changes; the Portal accepts the
 * current and previous major.
 */
import { z } from "zod";

export const PROTOCOL_VERSION = 1;

export const Channel = z.enum(["stable", "beta", "alpha"]);
export type Channel = z.infer<typeof Channel>;

// ---------------------------------------------------------------- heartbeat
// POST {PORTAL_URL}/v1/heartbeat every 5 min, body signed with the instance key (Ed25519).

export const HeartbeatRequest = z.object({
  instanceId: z.string().min(1),
  protocolVersion: z.number().int().positive(),
  appVersion: z.string(),
  channel: Channel,
  health: z.object({ db: z.boolean(), api: z.boolean(), storefront: z.boolean() }),
  usage: z.object({
    orgs: z.number().int().nonnegative(),
    sites: z.number().int().nonnegative(),
    seats: z.number().int().nonnegative(),
    storageMB: z.number().nonnegative(),
  }),
  orgs: z.array(z.object({ id: z.string(), name: z.string() })),
});
export type HeartbeatRequest = z.infer<typeof HeartbeatRequest>;

export const ReleaseInfo = z.object({
  version: z.string(),
  notes: z.string(),
  deprecated: z.boolean(),
});
export type ReleaseInfo = z.infer<typeof ReleaseInfo>;

/** Portal-minted, time-boxed support access; requires the owner's opt-in on the instance. */
export const ImpersonationGrant = z.object({
  grantId: z.string(),
  instanceId: z.string(),
  orgId: z.string(),
  actor: z.object({ id: z.string(), name: z.string() }),
  /** Unix seconds. */
  exp: z.number().int(),
});
export type ImpersonationGrant = z.infer<typeof ImpersonationGrant>;

export const HeartbeatResponse = z.object({
  /** Signed licence (JWS, verified against the Portal JWKS). */
  licenseToken: z.string().optional(),
  release: ReleaseInfo.optional(),
  grants: z.array(ImpersonationGrant).optional(),
  marketplaceEtag: z.string().optional(),
});
export type HeartbeatResponse = z.infer<typeof HeartbeatResponse>;

// ---------------------------------------------------------------- licence

export const Plan = z.enum(["free", "starter", "pro", "agency"]);
export type Plan = z.infer<typeof Plan>;

/** Claims inside `licenseToken`. Limits gate *creation* only; storefronts never degrade. */
export const LicenseClaims = z.object({
  iss: z.string(),
  sub: z.string().describe("instanceId"),
  accountId: z.string(),
  plan: Plan,
  limits: z.object({
    orgs: z.number().int().nullable(),
    sitesPerOrg: z.number().int().nullable(),
    seats: z.number().int().nullable(),
    customDomainsPerSite: z.number().int().nullable(),
  }),
  features: z.array(z.string()),
  iat: z.number().int(),
  exp: z.number().int(),
});
export type LicenseClaims = z.infer<typeof LicenseClaims>;

// ---------------------------------------------------------------- cubicles (apps)

export const AppScope = z.enum([
  "read_products",
  "write_products",
  "read_orders",
  "write_orders",
  "read_customers",
  "write_customers",
  "read_content",
  "write_content",
]);
export type AppScope = z.infer<typeof AppScope>;

export const AppSurface = z.enum(["admin_embed", "storefront_block", "webhook_only"]);

export const AppManifest = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
  name: z.string().min(1).max(80),
  version: z.string(),
  publisher: z.string(),
  scopes: z.array(AppScope),
  surfaces: z.array(AppSurface).min(1),
  appUrl: z.url(),
  redirectUrls: z.array(z.url()),
  webhooks: z.array(z.object({ topic: z.string(), url: z.url() })).default([]),
  pricing: z.discriminatedUnion("type", [
    z.object({ type: z.literal("free") }),
    z.object({ type: z.literal("oneTime"), amountCents: z.number().int().positive() }),
    z.object({ type: z.literal("subscription"), amountCents: z.number().int().positive(), interval: z.enum(["month", "year"]) }),
  ]),
});
export type AppManifest = z.infer<typeof AppManifest>;
