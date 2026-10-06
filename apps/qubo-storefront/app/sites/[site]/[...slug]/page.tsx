import type { Metadata } from "next";
import { RenderView, viewMetadata } from "@/lib/render";
import { JsonLd, breadcrumbLd } from "@/lib/seo";
import { getStorefront, hostFromParam, notFoundOrRedirect } from "@/lib/site";

type Params = Promise<{ site: string; slug: string[] }>;

/** Standalone pages built in Studio (`page` table), by slug. */
async function load(params: Params) {
  const { site, slug } = await params;
  const sf = await getStorefront(hostFromParam(site));
  if (!sf) return { sf, hit: null };
  const path = slug.map(decodeURIComponent).join("/");
  const page = await sf.client.getPage(path);
  return { sf, hit: page ? { sf, page, path } : null };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { hit } = await load(params);
  return hit ? viewMetadata(hit.sf, { title: hit.page.metaTitle || hit.page.title, description: hit.page.metaDescription, body: hit.page.data }) : {};
}

export default async function StudioPage({ params }: { params: Params }) {
  const { sf, hit } = await load(params);
  if (!hit) return notFoundOrRedirect(sf);
  return (
    <>
      <RenderView sf={hit.sf} body={hit.page.data} documentId={hit.page.documentId} />
      <JsonLd data={breadcrumbLd(hit.sf, [{ name: hit.page.title, path: `/${hit.path.split("/").map(encodeURIComponent).join("/")}` }])} />
    </>
  );
}
