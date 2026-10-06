import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { RenderView, viewMetadata } from "@/lib/render";
import { JsonLd, breadcrumbLd } from "@/lib/seo";
import { getStorefront, hostFromParam, localeHref, notFoundOrRedirect, requestPath } from "@/lib/site";

type Params = Promise<{ site: string; slug: string[] }>;

const encode = (slug: string) => slug.split("/").map(encodeURIComponent).join("/");

/** Standalone pages built in Studio (`page` table), by slug; in a secondary locale by its translated slug. */
async function load(params: Params) {
  const { site, slug } = await params;
  const sf = await getStorefront(hostFromParam(site));
  if (!sf) return { sf, hit: null };
  const path = slug.map(decodeURIComponent).join("/");
  const page = await sf.client.getPage(path);
  if (!page) return { sf, hit: null };
  // The page in every served locale, each under its own slug (hreflang and the language switch).
  const paths = Object.fromEntries(Object.entries(page.slugs).map(([locale, s]) => [locale, `/${s}`]));
  return { sf, hit: { sf, page, path, paths } };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { hit } = await load(params);
  return hit ? viewMetadata(hit.sf, { title: hit.page.metaTitle || hit.page.title, description: hit.page.metaDescription, body: hit.page.data, paths: hit.paths }) : {};
}

export default async function StudioPage({ params }: { params: Params }) {
  const { sf, hit } = await load(params);
  if (!hit) return notFoundOrRedirect(sf);
  // Reached through the primary slug while this locale has its own: one URL per page and language.
  if (hit.page.slug !== hit.path) {
    const query = (await requestPath()).split("?")[1];
    permanentRedirect(`${localeHref(hit.sf, hit.sf.locale, `/${encode(hit.page.slug)}`)}${query ? `?${query}` : ""}`);
  }
  return (
    <>
      <RenderView sf={hit.sf} body={hit.page.data} view={{ paths: hit.paths }} documentId={hit.page.documentId} />
      <JsonLd data={breadcrumbLd(hit.sf, [{ name: hit.page.title, path: `/${encode(hit.path)}` }])} />
    </>
  );
}
