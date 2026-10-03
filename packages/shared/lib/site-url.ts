/**
 * The one place a public storefront URL is built. Admin buttons ("View site"),
 * previews, sitemaps and emails all go through here, so dev never links to a
 * live domain and an unverified domain is never linked at all.
 *
 * Order: dev host map → primary verified domain → <slug>.<PLATFORM_BASE_DOMAIN> → null.
 * In dev (QUBO_DEV=1) the platform subdomain wins over verified domains.
 */

export type SiteUrlDomain = { hostname: string; isPrimary: boolean; verified: boolean };

export type SiteUrlEnv = {
  /** `host=slug,…` set by `qd` in dev, e.g. `localhost:4020=hm-froid`. */
  QUBO_DEV_SITE_HOSTS?: string;
  /** Platform-provided subdomains, e.g. `qubo.site` → `hm-froid.qubo.site`. */
  PLATFORM_BASE_DOMAIN?: string;
  QUBO_DEV?: string;
};

/** Public host for a site, or null when it has nowhere to be viewed yet. */
export function siteHost(
  site: { slug: string; domains: SiteUrlDomain[] },
  env: SiteUrlEnv = process.env as SiteUrlEnv,
): string | null {
  for (const pair of (env.QUBO_DEV_SITE_HOSTS ?? "").split(",")) {
    const [host, slug] = pair.split("=").map((s) => s?.trim());
    if (host && slug === site.slug) return host;
  }
  const base = env.PLATFORM_BASE_DOMAIN?.trim();
  const platformHost = base ? `${site.slug}.${base}` : null;
  if (platformHost && env.QUBO_DEV === "1") return platformHost;
  const verified = site.domains.filter((d) => d.verified);
  const primary = verified.find((d) => d.isPrimary) ?? verified[0];
  return primary?.hostname ?? platformHost;
}

const isLocal = (host: string) => /^(localhost|127\.|\[::1\])/.test(host);

/** Absolute URL on the site's public host, or null (show "Connect a domain"). */
export function siteUrl(
  site: { slug: string; domains: SiteUrlDomain[] },
  path = "/",
  env?: SiteUrlEnv,
): string | null {
  const host = siteHost(site, env);
  if (!host) return null;
  return `${isLocal(host) ? "http" : "https"}://${host}${path.startsWith("/") ? path : `/${path}`}`;
}
