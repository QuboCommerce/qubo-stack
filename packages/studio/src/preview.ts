import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Signed preview tokens let a storefront render a document's *draft* for the
 * Studio canvas or a shareable preview link, without a session. Stateless
 * HMAC: `<payload>.<sig>`, payload = base64url JSON { d, s, e }.
 */

type Payload = { d: string; s: string; e: number };
/** Site preview: whole-site draft access behind `preview.<domain>`, bound to the PIN's hash. */
type SitePayload = { s: string; p: string; e: number };

function secret() {
  const s = process.env.QUBO_PREVIEW_SECRET ?? process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("QUBO_PREVIEW_SECRET (or BETTER_AUTH_SECRET) must be set to sign previews.");
  return s;
}

const sign = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");

function verifySigned<T>(token: string): T | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as T & { e?: unknown };
    if (typeof p.e !== "number" || p.e < Date.now() / 1000) return null;
    return p;
  } catch {
    return null;
  }
}

export function createPreviewToken(input: { siteId: string; documentId: string; ttlSeconds?: number }) {
  const payload: Payload = { d: input.documentId, s: input.siteId, e: Math.floor(Date.now() / 1000) + (input.ttlSeconds ?? 3600) };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Returns the scope the token grants, or null if forged/expired. */
export function verifyPreviewToken(token: string): { siteId: string; documentId: string } | null {
  const p = verifySigned<Payload>(token);
  return p ? { siteId: p.s, documentId: p.d } : null;
}

/** Six digits; shown in the admin, typed once at the preview gate. */
export const generatePreviewPin = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

/** Short digest of the PIN embedded in tokens so regenerating the PIN revokes them. */
export const previewPinHash = (pin: string) => createHash("sha256").update(pin).digest("base64url").slice(0, 16);

export const SITE_PREVIEW_TTL_SECONDS = 12 * 3600;

/** Issued by the API after a correct PIN; stored by the storefront as a cookie. */
export function createSitePreviewToken(input: { siteId: string; pin: string; ttlSeconds?: number }) {
  const payload: SitePayload = { s: input.siteId, p: previewPinHash(input.pin), e: Math.floor(Date.now() / 1000) + (input.ttlSeconds ?? SITE_PREVIEW_TTL_SECONDS) };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Valid only for this site and while the PIN it was unlocked with is still current. */
export function verifySitePreviewToken(token: string, site: { id: string; pin: string | null }): boolean {
  const p = verifySigned<SitePayload>(token);
  return Boolean(p && site.pin && p.s === site.id && p.p === previewPinHash(site.pin));
}
