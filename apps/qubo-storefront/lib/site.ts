import { cache } from "react";
import { createStorefrontClient, QuboApiError, type LayoutResponse, type StorefrontClient } from "@qubo/storefront";
import { defineTheme, type Theme } from "@qubo/stylekit";
import { devSiteHosts, platformSubdomainSlug } from "./hosts";

export type Storefront = {
  host: string;
  client: StorefrontClient;
  site: LayoutResponse["site"];
  header: LayoutResponse["header"];
  footer: LayoutResponse["footer"];
  theme: Theme | undefined;
  /** Dev / preview hosts are never indexed. */
  noindex: boolean;
};

/** Route param → host (the proxy URL-encodes it into `/sites/<host>`). */
export const hostFromParam = (param: string) => decodeURIComponent(param).toLowerCase();

function parseTheme(input: unknown, host: string): Theme | undefined {
  if (!input) return undefined;
  try {
    return defineTheme(input as Parameters<typeof defineTheme>[0]);
  } catch (error) {
    console.warn(`[storefront] invalid live theme for ${host}; rendering unthemed`, error);
    return undefined;
  }
}

/**
 * Resolves the site for a host. Order: dev host map → `<slug>.<PLATFORM_BASE_DOMAIN>`
 * → `site_domain` (via the API) → `STOREFRONT_DEFAULT_SITE` (single-site installs).
 * Null = no site here. Memoised per request.
 */
export const getStorefront = cache(async (host: string): Promise<Storefront | null> => {
  const devSlug = devSiteHosts().get(host);
  const platformSlug = devSlug ? null : platformSubdomainSlug(host);
  const fallbackSlug = process.env.STOREFRONT_DEFAULT_SITE?.trim();
  const attempts = devSlug
    ? [{ siteSlug: devSlug }]
    : platformSlug
      ? [{ siteSlug: platformSlug }]
      : [{ host }, ...(fallbackSlug ? [{ siteSlug: fallbackSlug }] : [])];

  for (const target of attempts) {
    const client = createStorefrontClient({ ...target, host });
    try {
      const layout = await client.getLayout();
      return {
        host,
        client,
        site: layout.site,
        header: layout.header,
        footer: layout.footer,
        theme: parseTheme(layout.theme, host),
        noindex: Boolean(devSlug) || process.env.QUBO_DEV === "1",
      };
    } catch (error) {
      if (error instanceof QuboApiError && error.status === 400) continue; // site_not_resolved
      throw error;
    }
  }
  return null;
});
