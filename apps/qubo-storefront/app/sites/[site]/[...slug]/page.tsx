import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RenderView, viewMetadata } from "@/lib/render";
import { getStorefront, hostFromParam } from "@/lib/site";

type Params = Promise<{ site: string; slug: string[] }>;

/** Standalone pages built in Studio (`page` table), by slug. */
async function load(params: Params) {
  const { site, slug } = await params;
  const sf = await getStorefront(hostFromParam(site));
  if (!sf) return null;
  const page = await sf.client.getPage(slug.map(decodeURIComponent).join("/"));
  return page ? { sf, page } : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const hit = await load(params);
  return hit ? viewMetadata(hit.sf, { title: hit.page.metaTitle || hit.page.title, description: hit.page.metaDescription, body: hit.page.data }) : {};
}

export default async function StudioPage({ params }: { params: Params }) {
  const hit = await load(params);
  if (!hit) notFound();
  return <RenderView sf={hit.sf} body={hit.page.data} />;
}
