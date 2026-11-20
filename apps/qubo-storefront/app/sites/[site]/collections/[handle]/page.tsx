import type { Metadata } from "next";
import { RenderView, resolveCollection, saleTitle, tidyName, viewMetadata, type CollectionHit } from "@/lib/render";
import { JsonLd, breadcrumbLd, categoryCrumbs } from "@/lib/seo";
import { getStorefront, hostFromParam, notFoundOrRedirect, type Storefront } from "@/lib/site";

type Params = Promise<{ site: string; handle: string }>;

async function load(params: Params) {
  const { site, handle } = await params;
  const sf = await getStorefront(hostFromParam(site));
  if (!sf) return { sf, hit: null };
  const slug = decodeURIComponent(handle);
  const [found, tpl] = await Promise.all([resolveCollection(sf, slug), sf.client.getTemplate("collection")]);
  return { sf, hit: found && tpl ? { sf, tpl, slug, found } : null };
}

function seo(sf: Storefront, found: CollectionHit) {
  switch (found.kind) {
    case "all":
      return { title: null };
    case "sale":
      return { title: saleTitle(sf.locale) };
    case "category":
      return { title: tidyName(found.category.name) };
    case "collection": {
      const c = found.collection;
      return { title: c.metaTitle || c.name, description: c.metaDescription || c.description, image: c.image };
    }
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { hit } = await load(params);
  return hit ? viewMetadata(hit.sf, { ...seo(hit.sf, hit.found), body: hit.tpl.data }) : {};
}

export default async function CollectionPage({ params }: { params: Params }) {
  const { sf, hit } = await load(params);
  if (!hit) return notFoundOrRedirect(sf);
  const { found } = hit;
  const crumbs =
    found.kind === "category"
      ? categoryCrumbs(found.categories, found.category.slug)
      : found.kind === "collection"
        ? [{ name: found.collection.name, path: `/collections/${encodeURIComponent(found.collection.slug)}` }]
        : null;
  return (
    <>
      <RenderView sf={hit.sf} body={hit.tpl.data} view={{ collection: hit.slug }} documentId={hit.tpl.documentId} />
      {crumbs ? <JsonLd data={breadcrumbLd(hit.sf, crumbs)} /> : null}
    </>
  );
}
