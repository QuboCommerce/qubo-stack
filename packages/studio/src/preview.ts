import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed preview tokens let a storefront render a document's *draft* for the
 * Studio canvas or a shareable preview link, without a session. Stateless
 * HMAC: `<payload>.<sig>`, payload = base64url JSON { d, s, e }.
 */

type Payload = { d: string; s: string; e: number };

function secret() {
  const s = process.env.QUBO_PREVIEW_SECRET ?? process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("QUBO_PREVIEW_SECRET (or BETTER_AUTH_SECRET) must be set to sign previews.");
  return s;
}

const sign = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");

export function createPreviewToken(input: { siteId: string; documentId: string; ttlSeconds?: number }) {
  const payload: Payload = { d: input.documentId, s: input.siteId, e: Math.floor(Date.now() / 1000) + (input.ttlSeconds ?? 3600) };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Returns the scope the token grants, or null if forged/expired. */
export function verifyPreviewToken(token: string): { siteId: string; documentId: string } | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Payload;
    if (typeof p.e !== "number" || p.e < Date.now() / 1000) return null;
    return { siteId: p.s, documentId: p.d };
  } catch {
    return null;
  }
}
