/**
 * Wire types for the Qubo API.
 *
 * Deliberately hand-written rather than inferred from the Elysia app, so a
 * Next.js storefront never has to pull Bun types into its build. If these
 * drift from packages/api, the contract tests in that package should fail
 * before a storefront does.
 */

export type PriceSource =
  | "price-list-variant"
  | "price-list-product"
  | "variant"
  | "base";

/** Preset a Site was created from; mirrors the `site_type` enum in @qubo/db. */
export type SiteType = "store" | "services" | "business" | "editorial" | "custom";

export type SiteSummary = {
  id: string;
  slug: string;
  name: string;
  type: SiteType;
  currency: string;
  locale: string;
  organizationId: string;
  capabilities: string[];
};

export type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  position: number;
};

export type ProductListItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  brand: string | null;
  image: string | null;
  compareAtPrice: string | null;
  price: string;
  priceSource: PriceSource;
};

export type ProductVariantDetail = {
  id: string;
  name: string | null;
  sku: string | null;
  available: number | null;
  price: string;
  priceSource: PriceSource;
};

export type ProductDetail = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  brand: string | null;
  basePrice: string;
  compareAtPrice: string | null;
  images: { url: string; alt: string | null }[];
  variants: ProductVariantDetail[];
};

export type ProductListResponse = {
  site: string;
  currency: string;
  products: ProductListItem[];
};

export type ProductDetailResponse = {
  site: string;
  currency: string;
  product: ProductDetail;
};

export type CategoriesResponse = {
  site: string;
  categories: CategoryNode[];
};

/** A Puck document as stored by Studio (opaque to this package). */
export type RenderDocument = {
  root: { props?: Record<string, unknown> };
  content: { type: string; props: Record<string, unknown> }[];
  zones?: Record<string, { type: string; props: Record<string, unknown> }[]>;
};

/** Studio template kinds (mirrors `resource_kind` in @qubo/db). */
export type TemplateKind =
  | "home"
  | "page"
  | "search"
  | "product"
  | "collection"
  | "collection_list"
  | "cart"
  | "account"
  | "not_found"
  | "password"
  | "maintenance"
  | (string & {});

export type LayoutResponse = {
  site: SiteSummary;
  header: RenderDocument | null;
  footer: RenderDocument | null;
  /** Published theme JSON (validated by @qubo/stylekit on the storefront). */
  theme: unknown;
};

export type TemplateResponse = { documentId: string; data: RenderDocument };

export type PageResponse = {
  documentId: string;
  title: string;
  metaTitle: string | null;
  metaDescription: string | null;
  data: RenderDocument;
};

/** Verified public domains; `primary` is the canonical host (null = none verified). */
export type DomainsResponse = { primary: string | null; verified: string[] };

export type SitemapEntry = { slug: string; updatedAt: string };

export type SitemapResponse = {
  products: SitemapEntry[];
  categories: SitemapEntry[];
  pages: SitemapEntry[];
};

export type RedirectResponse = { to: string; status: number };
