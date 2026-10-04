import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The storefront calls the API server-to-server, so the API never sees the
 * visitor. The storefront forwards the visitor IP signed with the secret both
 * sides already share (preview tokens); unsigned or forged claims are ignored.
 */
export const CLIENT_IP_HEADER = "x-qubo-client-ip";
export const CLIENT_IP_SIG_HEADER = "x-qubo-client-sig";

const secret = () => process.env.QUBO_PREVIEW_SECRET ?? process.env.BETTER_AUTH_SECRET ?? "";
const mac = (ip: string, key: string) => createHmac("sha256", key).update(`client-ip:${ip}`).digest("hex");

export function signClientIp(ip: string): Record<string, string> {
  const key = secret();
  return key && ip ? { [CLIENT_IP_HEADER]: ip, [CLIENT_IP_SIG_HEADER]: mac(ip, key) } : {};
}

/** The signed visitor IP, or null when absent / not signed by us. */
export function verifiedClientIp(get: (name: string) => string | null | undefined): string | null {
  const ip = get(CLIENT_IP_HEADER)?.trim();
  const sig = get(CLIENT_IP_SIG_HEADER)?.trim();
  const key = secret();
  if (!ip || !sig || !key) return null;
  const expected = Buffer.from(mac(ip, key));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given) ? ip : null;
}
