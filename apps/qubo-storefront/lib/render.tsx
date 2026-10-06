import type { Metadata } from "next";
import { registry, walkNodes, type DocumentData, type RenderMetadata, type SiteType, type Capability } from "@qubo/blocks";
import type { ProductCard, ProductDetailData } from "@qubo/blocks";
import { QuboRender } from "@qubo/blocks/render";
import { runtimeTheme } from "@qubo/blocks/runtime";
import type { ProductDetail, ProductListItem, RenderDocument } from "@qubo/storefront";
import { requestPath, type Storefront } from "./site";
import { adminOrigin } from "./hosts";
import { StaffBar } from "@/components/staff-bar";
import { FormEnhancer } from "@/components/form-enhancer";
import { SiteRuntime } from "@/components/site-runtime";

/** What the current route is about; dynamic blocks default to it. */
export type ViewContext = {
  /** Collection (category) handle on /collections/<handle>. */
  collection?: string;
  /** Product on /products/<slug>; feeds ProductDetail and is excluded from its own grids. */
  product?: ProductDetail;
  /** Search query on /search?q=. */
  query?: string;
};

function toDetail(p: ProductDetail): ProductDetailData {
  const first = p.variants[0];
  return {
    slug: p.slug,
    title: p.name,
    brand: p.brand,
    description: p.description,
    sku: p.variants.length === 1 ? (first?.sku ?? null) : null,
    images: p.images.map((i) => ({ src: i.url, alt: i.alt ?? p.name })),
    price: first?.price ?? p.basePrice,
    compareAt: p.compareAtPrice,
    variants: p.variants.map((v) => ({ id: v.id, name: v.name, price: v.price, available: v.available })),
  };
}

const empty: RenderDocument = { root: { props: {} }, content: [] };

/** Header + body + footer as one document, so the theme root and styles are emitted once. */
function compose(sf: Storefront, body: RenderDocument): DocumentData {
  const parts = [sf.header ?? empty, body, sf.footer ?? empty];
  return {
    root: body.root ?? { props: {} },
    content: parts.flatMap((p) => p.content ?? []),
    zones: Object.assign({}, ...parts.map((p) => p.zones ?? {})),
  } as DocumentData;
}

function money(sf: Storefront, amount: string | null) {
  if (amount == null) return undefined;
  const value = Number(amount);
  if (!Number.isFinite(value)) return undefined;
  return new Intl.NumberFormat(sf.site.locale, { style: "currency", currency: sf.site.currency }).format(value);
}

function toCard(sf: Storefront, p: ProductListItem): ProductCard {
  return {
    title: p.name,
    href: `/products/${p.slug}`,
    image: p.image ? { src: p.image, alt: p.name } : undefined,
    price: money(sf, p.price),
    compareAt: p.compareAtPrice ? money(sf, p.compareAtPrice) : undefined,
  };
}

/** Prefetches data for dynamic blocks into `metadata.data[nodeId]`. */
async function loadBlockData(sf: Storefront, data: DocumentData, view: ViewContext) {
  const jobs: Promise<[string, unknown]>[] = [];
  walkNodes(data, registry, ({ node }) => {
    if (node.type === "ProductDetail") {
      const id = (node.props as { id: string }).id;
      if (view.product) jobs.push(Promise.resolve([id, toDetail(view.product)]));
      return;
    }
    if (node.type !== "ProductGrid") return;
    const props = node.props as { id: string; source?: string; collection?: string; products?: string; limit?: number };
    const limit = Math.min(Math.max(Number(props.limit) || 8, 1), 24);
    jobs.push(
      (async (): Promise<[string, unknown]> => {
        let items: ProductListItem[];
        if (props.source === "manual") {
          const slugs = (props.products ?? "").split(/\s+/).filter(Boolean).slice(0, limit);
          const found = await Promise.all(
            slugs.map((slug) =>
              sf.client
                .getProduct(slug)
                .then(({ product: p }): ProductListItem => ({
                  id: p.id,
                  slug: p.slug,
                  name: p.name,
                  description: p.description,
                  brand: p.brand,
                  image: p.images[0]?.url ?? null,
                  compareAtPrice: p.compareAtPrice,
                  price: p.variants[0]?.price ?? p.basePrice,
                  priceSource: p.variants[0]?.priceSource ?? "base",
                }))
                .catch(() => undefined),
            ),
          );
          items = found.filter((p): p is ProductListItem => Boolean(p));
        } else if (props.source === "search") {
          items = view.query ? (await sf.client.getProducts({ query: view.query, limit: limit + 1 })).products : [];
        } else {
          const handle = props.source === "collection" ? props.collection?.trim() || view.collection : undefined;
          const category = handle && handle !== "all" ? handle : undefined;
          items = (await sf.client.getProducts({ category, limit: limit + 1 })).products;
        }
        return [props.id, items.filter((p) => p.slug !== view.product?.slug).slice(0, limit).map((p) => toCard(sf, p))];
      })().catch((error) => {
        console.warn(`[storefront] ProductGrid ${props.id} failed`, error);
        return [props.id, []];
      }),
    );
  });
  return Object.fromEntries(await Promise.all(jobs));
}

export async function RenderView({ sf, body, view = {}, documentId }: { sf: Storefront; body: RenderDocument; view?: ViewContext; documentId?: string }) {
  const data = compose(sf, body);
  const metadata: RenderMetadata = {
    site: {
      id: sf.site.id,
      type: sf.site.type as SiteType,
      capabilities: sf.site.capabilities as Capability[],
      name: sf.site.name,
      currency: sf.site.currency,
      locale: sf.site.locale,
    },
    locale: sf.site.locale.split("-")[0],
    theme: sf.theme,
    data: await loadBlockData(sf, data, view),
  };
  return (
    <>
      <QuboRender registry={registry} data={data} metadata={metadata} />
      <FormEnhancer />
      <SiteRuntime theme={runtimeTheme(sf.theme)} />
      <StaffBar siteId={sf.site.id} siteSlug={sf.site.slug} adminOrigin={adminOrigin(new URL(sf.origin).host)} documentId={documentId} />
    </>
  );
}

/** Page metadata: explicit title → document root title → site name; dev hosts are noindex. */
export async function viewMetadata(sf: Storefront | null, opts: { title?: string | null; description?: string | null; body?: RenderDocument | null } = {}): Promise<Metadata> {
  if (!sf) return { title: "No site on this host", robots: { index: false, follow: false } };
  // Canonical drops the query: filters/sorting/tracking params are the same page.
  const path = (await requestPath()).split("?")[0];
  const rootTitle = opts.body?.root?.props?.title;
  const title = opts.title || (typeof rootTitle === "string" && rootTitle) || sf.site.name;
  const brand = sf.theme?.brand;
  const icon = brand?.favicon?.url || brand?.mark?.url;
  const og = brand?.ogImage?.url ? [{ url: brand.ogImage.url, alt: brand.ogImage.alt || sf.site.name, width: brand.ogImage.width, height: brand.ogImage.height }] : undefined;
  return {
    title: title === sf.site.name ? title : { absolute: opts.title ? `${title} · ${sf.site.name}` : title },
    icons: icon ? { icon, apple: brand?.mark?.url || icon } : undefined,
    twitter: og ? { card: "summary_large_image" } : undefined,
    description: opts.description ?? undefined,
    metadataBase: new URL(sf.origin),
    alternates: { canonical: path },
    openGraph: { siteName: sf.site.name, title, url: path, locale: sf.site.locale.replace("-", "_"), type: "website", images: og },
    robots: sf.noindex ? { index: false, follow: false } : undefined,
  };
}
