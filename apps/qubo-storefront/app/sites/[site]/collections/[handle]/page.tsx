import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RenderView, viewMetadata } from "@/lib/render";
import { getStorefront, hostFromParam } from "@/lib/site";

type Params = Promise<{ site: string; handle: string }>;

async function load(params: Params) {
  const { site, handle } = await params;
  const sf = await getStorefront(hostFromParam(site));
  if (!sf) return null;
  const slug = decodeURIComponent(handle);
  const [categories, tpl] = await Promise.all([sf.client.getCategories(), sf.client.getTemplate("collection")]);
  const category = slug === "all" ? { name: null, slug } : categories.find((c) => c.slug === slug);
  return category && tpl ? { sf, tpl, category } : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const hit = await load(params);
  return hit ? viewMetadata(hit.sf, { title: hit.category.name, body: hit.tpl.data }) : {};
}

export default async function CollectionPage({ params }: { params: Params }) {
  const hit = await load(params);
  if (!hit) notFound();
  return <RenderView sf={hit.sf} body={hit.tpl.data} view={{ collection: hit.category.slug }} />;
}
