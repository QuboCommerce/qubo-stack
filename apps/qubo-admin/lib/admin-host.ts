import "server-only";

import { db } from "@qubo/db/client";
import { site, siteDomain } from "@qubo/db/schema";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { siteHostFromAdminHost } from "@qubo/shared/admin-url";

const hostVariants = (host: string) => {
  const bare = host.toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
  return [bare, `www.${bare}`];
};

/** Site behind a verified domain (apex or www), or null. */
export async function siteForHost(host: string) {
  const [row] = await db
    .select({ id: site.id, slug: site.slug, name: site.name, isPrimary: siteDomain.isPrimary })
    .from(siteDomain)
    .innerJoin(site, eq(site.id, siteDomain.siteId))
    .where(and(inArray(siteDomain.hostname, hostVariants(host)), isNotNull(siteDomain.verifiedAt)))
    .limit(1);
  return row ?? null;
}

export async function isVerifiedSiteHost(host: string) {
  return Boolean(await siteForHost(host));
}

/** `qubo.hmfroid.be` → the HM Froid site (default site of that admin host). */
export async function siteForAdminHost(host: string) {
  const siteHost = siteHostFromAdminHost(host);
  return siteHost ? siteForHost(siteHost) : null;
}

/** Storefront origins allowed to call the panel with credentials (CORS on /api/me). */
export async function isAllowedStorefrontOrigin(origin: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  const host = url.host.toLowerCase();
  if (process.env.QUBO_DEV === "1") {
    const base = process.env.PLATFORM_BASE_DOMAIN?.trim().toLowerCase();
    if (base && host.endsWith(`.${base}`)) return true;
    for (const pair of (process.env.QUBO_DEV_SITE_HOSTS ?? "").split(",")) {
      if (pair.split("=")[0]?.trim().toLowerCase() === host) return true;
    }
  }
  if (url.protocol !== "https:") return false;
  const [row] = await db
    .select({ id: siteDomain.id })
    .from(siteDomain)
    .where(and(eq(siteDomain.hostname, host), isNotNull(siteDomain.verifiedAt)))
    .limit(1);
  return Boolean(row);
}

/** `qubo.<ip>.sslip.io` for this server's own IP: the install-day admin address (see @qubo/domains). */
export async function isFallbackAdminHost(host: string) {
  const { fallbackAdminHost } = await import("@qubo/domains");
  const { serverIps } = await import("@qubo/domains/server");
  const admin = process.env.ADMIN_SUBDOMAIN?.trim() || "qubo";
  const ips = await serverIps().catch(() => [] as string[]);
  return ips.some((ip) => fallbackAdminHost(ip, admin) === host.toLowerCase());
}
