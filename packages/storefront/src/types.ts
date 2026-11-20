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
  description?: string | null;
  /** Products directly in this category (not its children). */
  productCount?: number;
};

/** A published collection (rules or hand-picked products) with its own page at `/collections/<slug>`. */
export type CollectionSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** Image URL, used as the social share image. */
  image: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  /** Non-archived products the collection matches. */
  productCount: number;
};

export type CollectionsResponse = {
  site: string;
  collections: CollectionSummary[];
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
  metaTitle: string | null;
  metaDescription: string | null;
  /** Categories this product sits in; the first one is the breadcrumb parent. */
  categories: { name: string; slug: string }[];
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

export type Weekday = "mo" | "tu" | "we" | "th" | "fr" | "sa" | "su";
/** Same times on each listed day, "HH:MM" 24h. */
export type OpeningHoursRule = { days: Weekday[]; opens: string; closes: string };

/** Who runs the site: organisation identity plus the site's public contact details. */
export type SiteBusiness = {
  legalName: string | null;
  companyNumber: string | null;
  vatNumber: string | null;
  phone: string | null;
  email: string | null;
  address: { line1: string | null; line2: string | null; postalCode: string | null; city: string | null; country: string | null } | null;
  openingHours: OpeningHoursRule[];
  geo: { latitude: number; longitude: number } | null;
  /** schema.org type, e.g. "Store". Null = LocalBusiness. */
  type: string | null;
};

export type LayoutResponse = {
  site: SiteSummary;
  /** Site-wide title and description; the title is also the suffix of every page title. */
  seo: { title: string | null; description: string | null };
  business: SiteBusiness;
  header: RenderDocument | null;
  footer: RenderDocument | null;
  /** Published theme JSON (validated by @qubo/stylekit on the storefront). */
  theme: unknown;
  /** Maintenance mode from site settings; `active` already accounts for `endsAt`. */
  maintenance?: { active: boolean; message: string | null; endsAt: string | null };
  /** Languages the storefront serves: the primary one plus every published secondary locale. */
  locales: { locale: string; isPrimary: boolean }[];
};

export type CheckoutRequest = {
  items: { variantId: string; quantity: number }[];
  /** Origin Stripe returns to; must be a host that serves this site. */
  returnOrigin: string;
  /** Discount code; refused codes fail the checkout with `discount_refused`. */
  code?: string;
};

export type CheckoutResponse = { url: string };

export type DiscountCheckRequest = { code: string; items: { variantId: string; quantity: number }[] };

export type DiscountCheckResponse =
  | { ok: true; code: string; type: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING"; amount: string; freeShipping: boolean; subtotal: string }
  | { ok: false; reason: string };

export type TemplateResponse = { documentId: string; data: RenderDocument };

export type PageResponse = {
  documentId: string;
  /** Slug in the requested locale; differs from the URL when an old primary slug was used. */
  slug: string;
  /** Slug per served locale, for hreflang alternates and the language switch. */
  slugs: Record<string, string>;
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
  /** Published collections. */
  collections: SitemapEntry[];
  /** Published pages (home excluded), ordered by title, with translated slug/title per secondary locale. */
  pages: (SitemapEntry & { title: string; locales: Record<string, { slug?: string; title?: string }> })[];
};

export type RedirectResponse = { to: string; status: number };
