import { cache } from "react";
import { headers } from "next/headers";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { createStorefrontClient, QuboApiError, type LayoutResponse, type StorefrontClient } from "@qubo/storefront";
import { defineTheme, type Theme } from "@qubo/stylekit";
import { languageLabel, languageOf, localizePath, splitLocalePath } from "@qubo/shared/locale-url";
import { devSiteHosts, siteTargets } from "./hosts";
import { GATE_PATH, PREVIEW_HEADER } from "./preview";

export type Storefront = {
  host: string;
  client: StorefrontClient;
  site: LayoutResponse["site"];
  seo: LayoutResponse["seo"];
  business: LayoutResponse["business"];
  header: LayoutResponse["header"];
  footer: LayoutResponse["footer"];
  theme: Theme | undefined;
  /** Dev / preview hosts are never indexed. */
  noindex: boolean;
  /** Site preview (`preview.<domain>`, unlocked with the PIN): drafts, uncached. */
  preview: boolean;
  /** `https://<primary verified domain>` (or this host when none / in dev); canonical URLs and sitemaps use it. */
  origin: string;
  /** Set when this host is a non-primary alias of the site; the layout 301s there. */
  redirectHost: string | null;
  maintenance: NonNullable<LayoutResponse["maintenance"]> | null;
  /** Locale being rendered (`nl-BE`); the site's primary one without a URL prefix. */
  locale: string;
  primaryLocale: string;
  /** `/nl` for a secondary locale, `""` for the primary. Every internal href goes under it. */
  basePath: string;
  /** Primary first, then published secondary locales. */
  locales: { locale: string; isPrimary: boolean }[];
};

/** Current page's URL in another locale; `paths` overrides per locale (translated page slugs). */
export function localeHref(sf: Storefront, locale: string, path: string, paths: Record<string, string> = {}) {
  return localizePath(paths[locale] ?? path, locale, sf.primaryLocale);
}

/** Links for the header language switch and hreflang: one per served locale. */
export function localeLinks(sf: Storefront, path: string, paths: Record<string, string> = {}) {
  return sf.locales.map((l) => ({ locale: l.locale, label: languageLabel(l.locale), href: localeHref(sf, l.locale, path, paths), current: l.locale === sf.locale }));
}

/**
 * Published content is cached in Next's data cache and dropped on publish via
 * POST /api/revalidate (`site:<slug>` / `layouts`). The TTL only covers changes
 * that don't notify yet (catalogue edits).
 */
const CACHE_SECONDS = 300;
export const siteTag = (slug: string) => `site:${slug}`;
export const LAYOUTS_TAG = "layouts";

const cachedFetch = (tags: string[]) => (input: RequestInfo | URL, init?: RequestInit) =>
  init?.method && init.method !== "GET"
    ? fetch(input, { ...init, cache: "no-store" })
    : fetch(input, { ...init, next: { revalidate: CACHE_SECONDS, tags } });

const uncachedFetch = (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, cache: "no-store" });

const clientFor = (target: { siteSlug: string } | { host: string }, host: string, tags: string[], previewToken?: string, locale?: string) =>
  createStorefrontClient({
    ...target,
    host,
    locale,
    fetch: previewToken ? uncachedFetch : cachedFetch(tags),
    headers: previewToken ? { [PREVIEW_HEADER]: previewToken } : undefined,
  });

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

/** Resolves the site for a host (order: see `siteTargets`). Null = no site here. Memoised per request. */
export const getStorefront = cache(async (host: string): Promise<Storefront | null> => {
  const h = await headers();
  // Set by proxy.ts only on preview hosts, after the cookie passed the edge check.
  const previewToken = h.get(PREVIEW_HEADER) ?? undefined;
  // Language prefix the proxy stripped from the URL (`/nl/...` → "nl").
  const lang = h.get("x-qubo-lang");
  const devSlug = devSiteHosts().get(host);
  for (const target of siteTargets(host)) {
    const probe = clientFor(target, host, "siteSlug" in target ? [siteTag(target.siteSlug), LAYOUTS_TAG] : [LAYOUTS_TAG], previewToken);
    try {
      let [layout, domains] = await Promise.all([probe.getLayout(), probe.getDomains()]);
      const served = layout.locales?.length ? layout.locales : [{ locale: layout.site.locale, isPrimary: true }];
      const primaryLocale = served.find((l) => l.isPrimary)?.locale ?? layout.site.locale;
      let locale = primaryLocale;
      if (lang) {
        const match = served.find((l) => languageOf(l.locale) === lang);
        // `/fr/...` on a French-first site: one URL per page, so send it to the root.
        if (!match || match.isPrimary) {
          const full = h.get("x-qubo-path") ?? "/";
          if (match) permanentRedirect(splitLocalePath(full).path);
          notFound();
        }
        locale = match.locale;
      }
      // Everything after resolution is keyed by slug, so one tag drops the whole site.
      const client = clientFor({ siteSlug: layout.site.slug }, host, [siteTag(layout.site.slug)], previewToken, locale === primaryLocale ? undefined : locale);
      // Header and footer in the secondary language.
      if (locale !== primaryLocale) layout = await client.getLayout();
      const preview = Boolean(previewToken);
      // The proxy only checked the signature; the API binds the token to the current PIN. Back to the gate if that changed.
      if (preview && !(await client.checkPreview())) redirect(`${GATE_PATH}?expired=1`);
      const noindex = preview || Boolean(devSlug) || process.env.QUBO_DEV === "1";
      const primary = noindex ? null : domains.primary;
      const isAlias = Boolean(primary && host !== primary && (domains.verified.includes(host) || host === `www.${primary}`));
      return {
        host,
        client,
        site: layout.site,
        seo: layout.seo,
        business: layout.business,
        header: layout.header,
        footer: layout.footer,
        theme: parseTheme(layout.theme, host),
        noindex,
        preview,
        origin: `https://${primary ?? host}`,
        redirectHost: isAlias ? primary : null,
        maintenance: layout.maintenance?.active ? layout.maintenance : null,
        locale,
        primaryLocale,
        basePath: localizePath("/", locale, primaryLocale),
        locales: [...served].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)),
      };
    } catch (error) {
      if (error instanceof QuboApiError && error.status === 400) continue; // site_not_resolved
      throw error;
    }
  }
  return null;
});

/** Path + query of the current request, as the visitor typed it (set by proxy.ts), language prefix included. */
export async function requestPath(): Promise<string> {
  return (await headers()).get("x-qubo-path") ?? "/";
}

/** The request path without its language prefix: what the page is, independent of the locale. */
export async function logicalPath(): Promise<string> {
  const full = (await requestPath()).split("?")[0] ?? "/";
  return (await headers()).get("x-qubo-lang") ? splitLocalePath(full).path : full;
}

/** 404, unless a legacy redirect exists for this exact path. */
export async function notFoundOrRedirect(sf: Storefront | null): Promise<never> {
  if (sf) {
    const path = (await requestPath()).split("?")[0];
    const hit = await sf.client.getRedirect(path);
    if (hit) (hit.status === 301 || hit.status === 308 ? permanentRedirect : redirect)(hit.to);
  }
  notFound();
}
