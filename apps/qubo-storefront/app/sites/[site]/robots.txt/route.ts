import { getStorefront, hostFromParam } from "@/lib/site";

// Host-resolved at request time; never prerender at build (no API there).
export const dynamic = "force-dynamic";

/** Per-host robots.txt. Dev, preview and alias hosts block everything. */
export async function GET(_req: Request, { params }: { params: Promise<{ site: string }> }) {
  const sf = await getStorefront(hostFromParam((await params).site));
  const lines =
    !sf || sf.noindex
      ? ["User-agent: *", "Disallow: /"]
      : ["User-agent: *", "Allow: /", "Disallow: /cart", "Disallow: /account", "Disallow: /search", "Disallow: /api/", "", `Sitemap: ${sf.origin}/sitemap.xml`];
  return new Response(`${lines.join("\n")}\n`, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
