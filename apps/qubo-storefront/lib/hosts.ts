/**
 * Host handling shared by the proxy (edge) and server components.
 * Kept dependency-free so it can run in the proxy runtime.
 */

/** Lowercased hostname without port, from the forwarded or direct Host header. */
export function requestHost(headers: Headers): string {
  const raw = headers.get("x-forwarded-host") ?? headers.get("host") ?? "";
  return raw.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}

/** `QUBO_DEV_SITE_HOSTS=localhost:4020=hm-froid` → host → site slug. */
export function devSiteHosts(): Map<string, string> {
  const map = new Map<string, string>();
  for (const pair of (process.env.QUBO_DEV_SITE_HOSTS ?? "").split(",")) {
    const [host, slug] = pair.split("=").map((s) => s?.trim());
    if (host && slug) map.set(host.toLowerCase().replace(/:\d+$/, ""), slug);
  }
  return map;
}

/** `hm-froid.qubo.site` → `hm-froid` when PLATFORM_BASE_DOMAIN=qubo.site (one label only). */
export function platformSubdomainSlug(host: string): string | null {
  const base = process.env.PLATFORM_BASE_DOMAIN?.trim().toLowerCase();
  if (!base || !host.endsWith(`.${base}`)) return null;
  const label = host.slice(0, -base.length - 1);
  return /^[a-z0-9-]+$/.test(label) ? label : null;
}

/** The admin host for a storefront host: dev override, else `qubo.<domain>` (ADMIN_SUBDOMAIN). */
export { adminHost as adminHostFor, adminOrigin } from "@qubo/shared/admin-url";

/**
 * Resolution order for a storefront host: dev host map → `<slug>.<PLATFORM_BASE_DOMAIN>`
 * → `site_domain` (via the API) → `STOREFRONT_DEFAULT_SITE` (single-site installs).
 */
export function siteTargets(host: string): ({ siteSlug: string } | { host: string })[] {
  const devSlug = devSiteHosts().get(host);
  if (devSlug) return [{ siteSlug: devSlug }];
  const platformSlug = platformSubdomainSlug(host);
  if (platformSlug) return [{ siteSlug: platformSlug }];
  const fallbackSlug = process.env.STOREFRONT_DEFAULT_SITE?.trim();
  return [{ host }, ...(fallbackSlug ? [{ siteSlug: fallbackSlug }] : [])];
}

/**
 * Site preview lives on its own host so nothing is shared with the public site:
 * `preview.<domain>` for custom domains, `<slug>.preview.<PLATFORM_BASE_DOMAIN>`
 * on the platform. Returns the host the site resolves under, or null when this
 * is not a preview host.
 */
export function previewSiteHost(host: string): string | null {
  const base = process.env.PLATFORM_BASE_DOMAIN?.trim().toLowerCase();
  if (base && host.endsWith(`.preview.${base}`)) {
    const label = host.slice(0, -`.preview.${base}`.length);
    return /^[a-z0-9-]+$/.test(label) ? `${label}.${base}` : null;
  }
  return host.startsWith("preview.") && host.indexOf(".", "preview.".length) > 0 ? host.slice("preview.".length) : null;
}
