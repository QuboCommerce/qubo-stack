/**
 * Site preview gate. Runs in the proxy (edge runtime), so only WebCrypto.
 * The cookie holds the token the API issued after a correct PIN. The proxy
 * checks signature and expiry before any site code runs; the API re-checks it
 * against the current PIN on every read, so a regenerated PIN revokes access.
 */
export const PREVIEW_COOKIE = "qb_preview";
export const PREVIEW_HEADER = "x-qubo-preview";
export const GATE_PATH = "/preview-gate";
export const UNLOCK_PATH = "/api/preview/unlock";

function secret(): string {
  const s = process.env.QUBO_PREVIEW_SECRET ?? process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("QUBO_PREVIEW_SECRET (or BETTER_AUTH_SECRET) must be set to verify previews.");
  return s;
}

const b64url = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Signature + expiry only; the PIN binding is enforced by the API. */
export async function previewTokenLooksValid(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = b64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return false;
  try {
    const p = JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/"))) as { e?: unknown };
    return typeof p.e === "number" && p.e > Date.now() / 1000;
  } catch {
    return false;
  }
}
