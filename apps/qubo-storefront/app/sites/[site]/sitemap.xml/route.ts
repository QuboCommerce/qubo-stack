import { getStorefront, hostFromParam, localeHref } from "@/lib/site";

// Host-resolved at request time; never prerender at build (no API there).
export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Per-host sitemap: home, published pages and (with `catalog`) collections +
 * products, on the canonical origin. Multilingual sites list every language's
 * URL, each with `xhtml:link` alternates for the others and an x-default.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ site: string }> }) {
  const sf = await getStorefront(hostFromParam((await params).site));
  if (!sf) return new Response("Not found", { status: 404 });

  const data = await sf.client.getSitemap();
  const catalog = sf.site.capabilities.includes("catalog");
  // Logical entries; `paths` carries per-locale slugs for pages that have translated ones.
  const entries: { path: string; lastmod?: string; paths?: Record<string, string> }[] = [
    { path: "/" },
    ...data.pages.map((p) => ({
      path: `/${p.slug}`,
      lastmod: p.updatedAt,
      paths: Object.fromEntries(Object.entries(p.locales).flatMap(([l, t]) => (t.slug ? [[l, `/${t.slug}`]] : []))),
    })),
    ...(catalog
      ? [
          { path: "/collections" },
          ...data.categories.map((c) => ({ path: `/collections/${c.slug}`, lastmod: c.updatedAt })),
          ...data.products.map((p) => ({ path: `/products/${p.slug}`, lastmod: p.updatedAt })),
        ]
      : []),
  ];
  const multilingual = sf.locales.length > 1;
  const abs = (path: string) => `${sf.origin}${path.split("/").map(encodeURIComponent).join("/")}`;
  const urls = entries.flatMap(({ path, lastmod, paths }) => {
    const locales = multilingual ? sf.locales : [{ locale: sf.primaryLocale, isPrimary: true }];
    const alternates = locales.map((l) => ({ hreflang: l.locale, href: abs(localeHref(sf, l.locale, path, paths)) }));
    const xDefault = alternates.find((a) => a.hreflang === sf.primaryLocale)?.href;
    return alternates.map((a) => ({
      loc: a.href,
      lastmod,
      links: multilingual ? [...alternates, ...(xDefault ? [{ hreflang: "x-default", href: xDefault }] : [])] : [],
    }));
  });

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${multilingual ? ' xmlns:xhtml="http://www.w3.org/1999/xhtml"' : ""}>\n` +
    urls
      .map(({ loc, lastmod, links }) => {
        const alt = links.map((l) => `<xhtml:link rel="alternate" hreflang="${l.hreflang}" href="${esc(l.href)}"/>`).join("");
        return `  <url><loc>${esc(loc)}</loc>${lastmod ? `<lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ""}${alt}</url>`;
      })
      .join("\n") +
    `\n</urlset>\n`;

  return new Response(body, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
