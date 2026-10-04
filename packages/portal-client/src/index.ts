/**
 * Instance ↔ Portal. The portal is optional: an unlinked instance is a complete
 * product on FREE_LIMITS. Linking adds a signed licence (plan limits/features),
 * update notices and fleet visibility. Nothing here ever locks the instance;
 * a missing, stale or unreachable portal degrades to Free at worst.
 */
import { asc, count, eq } from "drizzle-orm";
import { createRemoteJWKSet, jwtVerify, importJWK, exportJWK, type JWK } from "jose";
import { db } from "@qubo/db/client";
import { organization, portalLink, site } from "@qubo/db/schema";
import {
  FREE_LIMITS,
  HEARTBEAT_INTERVAL_SECONDS,
  HeartbeatResponse,
  LicenseClaims,
  PROTOCOL_VERSION,
  RegisterInstanceResponse,
  SIGNATURE_HEADERS,
  signingPayload,
  type HeartbeatRequest,
} from "@qubo/protocol";

export type PortalLink = typeof portalLink.$inferSelect;
export type Limits = LicenseClaims["limits"];

/** Where the licence currently comes from; shown in the admin, never used to block. */
export type LicenceSource = "unlinked" | "licence" | "grace" | "expired";

export type Entitlements = {
  source: LicenceSource;
  plan: LicenseClaims["plan"];
  limits: Limits;
  features: string[];
  /** Unix seconds; undefined when unlinked. */
  expiresAt?: number;
  graceEndsAt?: number;
};

export const DEFAULT_PORTAL_URL = "https://portal.qubo.by-ali.dev";
export const HEARTBEAT_INTERVAL_MS = HEARTBEAT_INTERVAL_SECONDS * 1000;

const appVersion = () => process.env.QUBO_VERSION ?? "0.0.0";
const channel = () => (process.env.QUBO_CHANNEL === "beta" ? "beta" : "stable") as HeartbeatRequest["channel"];
const apiOf = (portalUrl: string) => process.env.PORTAL_API_URL ?? portalUrl.replace(/\/$/, "").replace("://portal.", "://api.portal.");

export async function getLink(): Promise<PortalLink | null> {
  const [row] = await db.select().from(portalLink).limit(1);
  return row ?? null;
}

export class PortalError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(`portal ${status} ${code}`);
  }
}

async function post<T>(url: string, body: string, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body, signal: AbortSignal.timeout(15_000) });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new PortalError(res.status, data.error ?? "unknown");
  return data as T;
}

/** Links this instance to a portal organisation with a one-time registration token from the portal. */
export async function link(input: { portalUrl?: string; token: string; name: string }): Promise<PortalLink> {
  if (await getLink()) throw new PortalError(409, "already_linked");
  const portalUrl = (input.portalUrl ?? DEFAULT_PORTAL_URL).replace(/\/$/, "");
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const publicKeyJwk = await exportJWK(pair.publicKey);
  const privateKeyJwk = await exportJWK(pair.privateKey);
  const rawPub = Buffer.from(await crypto.subtle.exportKey("raw", pair.publicKey)).toString("base64url");

  const reg = RegisterInstanceResponse.parse(
    await post(`${apiOf(portalUrl)}/v1/instances/register`, JSON.stringify({ token: input.token, name: input.name, publicKey: rawPub, appVersion: appVersion(), channel: channel() })),
  );
  const [row] = await db
    .insert(portalLink)
    .values({ portalUrl, instanceId: reg.instanceId, portalOrganizationId: reg.organizationId, jwksUrl: reg.jwksUrl, publicKeyJwk, privateKeyJwk })
    .returning();
  await heartbeat().catch(() => undefined); // first licence; failures are recorded on the row
  return (await getLink()) ?? row!;
}

export async function unlink(): Promise<void> {
  await db.delete(portalLink);
}

async function usage() {
  const [[orgs], [sites]] = await Promise.all([db.select({ n: count() }).from(organization), db.select({ n: count() }).from(site)]);
  const orgRows = await db.select({ id: organization.id, name: organization.name }).from(organization);
  return { counts: { orgs: orgs?.n ?? 0, sites: sites?.n ?? 0, seats: 0, storageMB: 0 }, orgs: orgRows };
}

/** Signed heartbeat → fresh licence. Safe to call often; errors are stored, never thrown to callers that pass `quiet`. */
export async function heartbeat(opts: { quiet?: boolean } = {}): Promise<Entitlements> {
  const linkRow = await getLink();
  if (!linkRow) return entitlementsFor(null);
  try {
    const u = await usage();
    const body: HeartbeatRequest = {
      instanceId: linkRow.instanceId,
      protocolVersion: PROTOCOL_VERSION,
      appVersion: appVersion(),
      channel: channel(),
      health: { db: true, api: true, storefront: true },
      usage: u.counts,
      orgs: u.orgs,
    };
    const raw = JSON.stringify(body);
    const ts = Math.floor(Date.now() / 1000);
    const key = await importJWK(linkRow.privateKeyJwk as JWK, "EdDSA");
    const sig = Buffer.from(await crypto.subtle.sign("Ed25519", key as CryptoKey, new TextEncoder().encode(signingPayload(ts, raw)))).toString("base64url");
    const res = HeartbeatResponse.parse(
      await post(`${apiOf(linkRow.portalUrl)}/v1/heartbeat`, raw, {
        [SIGNATURE_HEADERS.instance]: linkRow.instanceId,
        [SIGNATURE_HEADERS.timestamp]: String(ts),
        [SIGNATURE_HEADERS.signature]: sig,
      }),
    );
    const now = new Date();
    const patch: Partial<PortalLink> = { lastHeartbeatAt: now, lastError: null, updatedAt: now };
    if (res.licenseToken) {
      const { payload } = await jwtVerify(res.licenseToken, createRemoteJWKSet(new URL(linkRow.jwksUrl)), { subject: linkRow.instanceId });
      const claims = LicenseClaims.parse(payload);
      Object.assign(patch, { licenseToken: res.licenseToken, licenseClaims: claims, licenseFetchedAt: now });
    }
    await db.update(portalLink).set(patch).where(eq(portalLink.id, linkRow.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.update(portalLink).set({ lastError: message, updatedAt: new Date() }).where(eq(portalLink.id, linkRow.id));
    if (!opts.quiet) throw error;
  }
  return entitlementsFor(await getLink());
}

/** Effective limits from the cached licence; valid → licence, past exp but within grace → grace, else Free. */
export function entitlementsFor(linkRow: PortalLink | null, now = Date.now() / 1000): Entitlements {
  const free: Entitlements = { source: "unlinked", plan: "free", limits: FREE_LIMITS, features: [] };
  if (!linkRow) return free;
  const parsed = LicenseClaims.safeParse(linkRow.licenseClaims);
  if (!parsed.success) return { ...free, source: "expired" };
  const c = parsed.data;
  const graceEndsAt = c.exp + c.grace;
  if (now <= c.exp) return { source: "licence", plan: c.plan, limits: c.limits, features: c.features, expiresAt: c.exp, graceEndsAt };
  if (now <= graceEndsAt) return { source: "grace", plan: c.plan, limits: c.limits, features: c.features, expiresAt: c.exp, graceEndsAt };
  return { ...free, source: "expired", expiresAt: c.exp, graceEndsAt };
}

export async function entitlements(): Promise<Entitlements> {
  return entitlementsFor(await getLink());
}

export type Quota = { used: number; limit: number | null; canCreate: boolean };

/**
 * Who is inside the licence on this instance. Limits are pooled per instance and gate
 * *creation* and *admin access* only; storefronts of locked sites stay online.
 *
 * Seniority decides when there are more orgs/sites than the plan covers (e.g. after a
 * downgrade): the oldest orgs are licensed, then the oldest sites inside licensed orgs.
 * Everything else is locked in the admin until the plan grows or something is removed.
 */
export type Access = {
  entitlements: Entitlements;
  orgs: Quota;
  sites: Quota;
  lockedOrgIds: Set<string>;
  lockedSiteIds: Set<string>;
};

export function accessFor(
  ent: Entitlements,
  orgs: { id: string; createdAt: Date }[],
  sites: { id: string; organizationId: string; createdAt: Date }[],
): Access {
  const byAge = <T extends { createdAt: Date; id: string }>(a: T, b: T) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);
  const { orgs: orgLimit, sites: siteLimit } = ent.limits;

  const sortedOrgs = [...orgs].sort(byAge);
  const licensedOrgs = new Set(sortedOrgs.slice(0, orgLimit ?? sortedOrgs.length).map((o) => o.id));
  const lockedOrgIds = new Set(sortedOrgs.filter((o) => !licensedOrgs.has(o.id)).map((o) => o.id));

  const sortedSites = [...sites].sort(byAge);
  const lockedSiteIds = new Set<string>();
  let licensedSites = 0;
  for (const s of sortedSites) {
    if (lockedOrgIds.has(s.organizationId) || (siteLimit !== null && licensedSites >= siteLimit)) lockedSiteIds.add(s.id);
    else licensedSites++;
  }

  return {
    entitlements: ent,
    orgs: { used: orgs.length, limit: orgLimit, canCreate: orgLimit === null || orgs.length < orgLimit },
    sites: { used: sites.length, limit: siteLimit, canCreate: siteLimit === null || sites.length < siteLimit },
    lockedOrgIds,
    lockedSiteIds,
  };
}

export async function access(): Promise<Access> {
  const [ent, orgs, sites] = await Promise.all([
    entitlements(),
    db.select({ id: organization.id, createdAt: organization.createdAt }).from(organization).orderBy(asc(organization.createdAt)),
    db.select({ id: site.id, organizationId: site.organizationId, createdAt: site.createdAt }).from(site).orderBy(asc(site.createdAt)),
  ]);
  return accessFor(ent, orgs, sites);
}

/** Background loop for the API process: one heartbeat soon after boot, then every HEARTBEAT_INTERVAL_MS. */
export function startHeartbeatLoop(log: (msg: string) => void = console.log) {
  const tick = async () => {
    const linkRow = await getLink().catch(() => null);
    if (!linkRow) return;
    const ent = await heartbeat({ quiet: true });
    log(`[portal] heartbeat → ${ent.source} (${ent.plan})`);
  };
  const first = setTimeout(tick, 30_000);
  const timer = setInterval(tick, HEARTBEAT_INTERVAL_MS);
  first.unref?.();
  timer.unref?.();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
