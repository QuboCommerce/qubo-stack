import { getStorefront, hostFromParam } from "@/lib/site";

// Host-resolved at request time; never prerender at build (no API there).
export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Per-host sitemap: home, published pages and (with `catalog`) collections + products, on the canonical origin. */
export async function GET(_req: Request, { params }: { params: Promise<{ site: string }> }) {
  const sf = await getStorefront(hostFromParam((await params).site));
  if (!sf) return new Response("Not found", { status: 404 });

  const data = await sf.client.getSitemap();
  const catalog = sf.site.capabilities.includes("catalog");
  const urls: { path: string; lastmod?: string }[] = [
    { path: "/" },
    ...data.pages.map((p) => ({ path: `/${p.slug}`, lastmod: p.updatedAt })),
    ...(catalog
      ? [
          { path: "/collections" },
          ...data.categories.map((c) => ({ path: `/collections/${c.slug}`, lastmod: c.updatedAt })),
          ...data.products.map((p) => ({ path: `/products/${p.slug}`, lastmod: p.updatedAt })),
        ]
      : []),
  ];

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(({ path, lastmod }) => {
        const loc = `${sf.origin}${path.split("/").map(encodeURIComponent).join("/")}`;
        return `  <url><loc>${esc(loc)}</loc>${lastmod ? `<lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ""}</url>`;
      })
      .join("\n") +
    `\n</urlset>\n`;

  return new Response(body, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
