import { db } from "@qubo/db/client";
import { siteDomain } from "@qubo/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";

/**
 * Origins that serve `site`: its platform subdomain, verified custom domains and
 * (dev only) localhost / `QUBO_DEV_SITE_HOSTS`. Used for Stripe return URLs and
 * as Better Auth trusted origins, so neither accepts an arbitrary caller origin.
 * Returns the normalised origin, or null.
 */
export async function allowedSiteOrigin(site: { id: string; slug: string }, origin: string) {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const dev = process.env.QUBO_DEV === "1";
  if (url.protocol !== "https:" && !(dev && url.protocol === "http:")) return null;
  const base = process.env.PLATFORM_BASE_DOMAIN?.trim().toLowerCase();
  if (base && host === `${site.slug}.${base}`) return url.origin;
  if (dev && (host === "localhost" || host === "127.0.0.1")) return url.origin;
  const devHosts = (process.env.QUBO_DEV_SITE_HOSTS ?? "").split(",").map((pair) => pair.trim().split("="));
  if (devHosts.some(([h, slug]) => slug === site.slug && h?.split(":")[0] === host)) return url.origin;
  const [verified] = await db
    .select({ id: siteDomain.id })
    .from(siteDomain)
    .where(and(eq(siteDomain.siteId, site.id), eq(siteDomain.hostname, host.replace(/^www\./, "")), isNotNull(siteDomain.verifiedAt)))
    .limit(1);
  return verified ? url.origin : null;
}
