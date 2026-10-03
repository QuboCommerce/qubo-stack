import type { Metadata } from "next";
import { QuboApiError } from "@qubo/storefront";
import { RenderView, viewMetadata } from "@/lib/render";
import { getStorefront, hostFromParam, notFoundOrRedirect } from "@/lib/site";

type Params = Promise<{ site: string; handle: string }>;

async function load(params: Params) {
  const { site, handle } = await params;
  const sf = await getStorefront(hostFromParam(site));
  if (!sf) return { sf, hit: null };
  const [product, tpl] = await Promise.all([
    sf.client.getProduct(decodeURIComponent(handle)).then(
      (r) => r.product,
      (e) => (e instanceof QuboApiError && e.status === 404 ? null : Promise.reject(e)),
    ),
    sf.client.getTemplate("product"),
  ]);
  return { sf, hit: product && tpl ? { sf, tpl, product } : null };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { hit } = await load(params);
  if (!hit) return {};
  const meta = await viewMetadata(hit.sf, { title: hit.product.name, description: hit.product.description, body: hit.tpl.data });
  const image = hit.product.images[0];
  return image ? { ...meta, openGraph: { ...meta.openGraph, images: [{ url: image.url, alt: image.alt ?? hit.product.name }] } } : meta;
}

export default async function ProductPage({ params }: { params: Params }) {
  const { sf, hit } = await load(params);
  if (!hit) return notFoundOrRedirect(sf);
  return <RenderView sf={hit.sf} body={hit.tpl.data} view={{ product: hit.product }} documentId={hit.tpl.documentId} />;
}
