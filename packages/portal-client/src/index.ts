/**
 * Instance ↔ Portal. The portal is optional: an unlinked instance is a complete
 * product on FREE_LIMITS. Linking adds a signed licence (plan limits/features),
 * update notices and fleet visibility. Nothing here ever locks the instance;
 * a missing, stale or unreachable portal degrades to Free at worst.
 */
import { count, eq } from "drizzle-orm";
import { createRemoteJWKSet, jwtVerify, importJWK, exportJWK, type JWK } from "jose";
import { db } from "@qubo/db/client";
import { organization, portalLink, site } from "@qubo/db/schema";
import {
  FREE_LIMITS,
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
export const HEARTBEAT_INTERVAL_MS = 6 * 3600 * 1000;

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

export type SiteQuota = { used: number; limit: number | null; canCreate: boolean; entitlements: Entitlements };

/** The one gate the product enforces: how many sites an organisation may run on this instance. */
export async function siteQuota(organizationId: string): Promise<SiteQuota> {
  const [ent, [row]] = await Promise.all([
    entitlements(),
    db.select({ n: count() }).from(site).where(eq(site.organizationId, organizationId)),
  ]);
  const used = row?.n ?? 0;
  const limit = ent.limits.sitesPerOrg;
  return { used, limit, canCreate: limit === null || used < limit, entitlements: ent };
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
