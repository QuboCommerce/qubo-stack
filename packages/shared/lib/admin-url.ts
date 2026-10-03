import { getDomain } from "tldts";

/**
 * Where the Qubo panel lives for a site: `qubo.<primary domain>` in production,
 * the dev override (`QUBO_ADMIN_HOSTS`, first entry) in dev. The prefix is
 * configurable via `ADMIN_SUBDOMAIN`. Used by the storefront Edit pen, the
 * `/admin` shortcut, "Open Qubo" and e-mails; never build admin URLs by hand.
 */

export type AdminUrlEnv = {
  QUBO_ADMIN_HOSTS?: string;
  ADMIN_SUBDOMAIN?: string;
};

export const adminSubdomain = (env: AdminUrlEnv = process.env as AdminUrlEnv) =>
  (env.ADMIN_SUBDOMAIN?.trim() || "qubo").toLowerCase();

/** Admin host for a storefront host (`www.` is dropped). */
export function adminHost(siteHost: string, env: AdminUrlEnv = process.env as AdminUrlEnv): string {
  const dev = (env.QUBO_ADMIN_HOSTS ?? "").split(",")[0]?.trim();
  if (dev) return dev.toLowerCase();
  return `${adminSubdomain(env)}.${siteHost.toLowerCase().replace(/^www\./, "")}`;
}

const isLocal = (host: string) => /^(localhost|127\.|\[::1\])/.test(host);

export function adminOrigin(siteHost: string, env?: AdminUrlEnv): string {
  const host = adminHost(siteHost, env);
  return `${isLocal(host) ? "http" : "https"}://${host}`;
}

export function adminUrl(siteHost: string, path = "/", env?: AdminUrlEnv): string {
  return `${adminOrigin(siteHost, env)}${path.startsWith("/") ? path : `/${path}`}`;
}

/** `qubo.hmfroid.be` → `hmfroid.be`; null when the host isn't an admin host. */
export function siteHostFromAdminHost(host: string, env: AdminUrlEnv = process.env as AdminUrlEnv): string | null {
  const prefix = `${adminSubdomain(env)}.`;
  const h = host.toLowerCase().replace(/:\d+$/, "");
  return h.startsWith(prefix) && h.length > prefix.length ? h.slice(prefix.length) : null;
}

/**
 * Registrable domain (`shop.example.co.uk` → `example.co.uk`) for parent-domain
 * cookies such as the `qubo_staff` hint. Null for IPs, localhost and public suffixes.
 */
export function registrableDomain(host: string): string | null {
  const h = host.toLowerCase().replace(/:\d+$/, "");
  if (isLocal(h)) return null;
  return getDomain(h, { allowPrivateDomains: true }) ?? null;
}

/** Name of the non-secret hint cookie that makes the storefront show the Edit pen. */
export const STAFF_HINT_COOKIE = "qubo_staff";
