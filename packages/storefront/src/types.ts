/**
 * Wire types for the Peltier API.
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

export type StoreSummary = {
  id: string;
  slug: string;
  name: string;
  currency: string;
  locale: string;
  organizationId: string;
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
  store: string;
  currency: string;
  products: ProductListItem[];
};

export type ProductDetailResponse = {
  store: string;
  currency: string;
  product: ProductDetail;
};

export type CategoriesResponse = {
  store: string;
  categories: CategoryNode[];
};
