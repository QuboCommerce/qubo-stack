import type {
  CategoriesResponse,
  DomainsResponse,
  LayoutResponse,
  RedirectResponse,
  SitemapResponse,
  PageResponse,
  TemplateKind,
  TemplateResponse,
  ProductDetailResponse,
  ProductListResponse,
  SiteSummary,
  CheckoutRequest,
  CheckoutResponse,
} from "./types";

export class QuboApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
  ) {
    super(message ?? `Qubo API error ${status}: ${code}`);
    this.name = "QuboApiError";
  }
}

export type StorefrontClientOptions = {
  /** Base URL of qubo-elysia, e.g. http://qubo-elysia:3333 */
  baseUrl?: string;
  /** Site slug this storefront serves, e.g. "hm-froid" or "tailg-belgium". */
  siteSlug?: string;
  /**
   * Public hostname the visitor asked for. Used when no slug is known: the API
   * resolves it against `site_domain`. Ignored when `siteSlug` is set.
   */
  host?: string;
  /**
   * Forwarded so the API can resolve the logged-in customer and therefore
   * their reseller price list. Without this every caller sees list price.
   */
  headers?: HeadersInit;
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

const qs = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const out = search.toString();
  return out ? `?${out}` : "";
};

const orNull = <T>(promise: Promise<T>) =>
  promise.catch((error: unknown) => {
    if (error instanceof QuboApiError && error.status === 404) return null;
    throw error;
  });

/**
 * The single way a storefront talks to Qubo.
 *
 * Every storefront gets identical catalogue, pricing and tenancy behaviour by
 * construction, which is what makes adding a second site a configuration
 * change rather than a port.
 */
export function createStorefrontClient(options: StorefrontClientOptions) {
  const baseUrl = (
    options.baseUrl ??
    process.env.QUBO_API_URL ??
    "http://localhost:3333"
  ).replace(/\/$/, "");

  const doFetch = options.fetch ?? fetch;
  if (!options.siteSlug && !options.host) {
    throw new Error("createStorefrontClient: pass siteSlug or host");
  }
  const siteHeaders: Record<string, string> = options.siteSlug
    ? { "x-qubo-site": options.siteSlug }
    : { "x-forwarded-host": options.host! };

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await doFetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        ...siteHeaders,
        ...options.headers,
        ...init?.headers,
      },
    });

    if (!response.ok) {
      let code = "unknown";
      try {
        code = ((await response.json()) as { error?: string }).error ?? code;
      } catch {
        // Non-JSON error body; the status code is the useful signal.
      }
      throw new QuboApiError(response.status, code);
    }

    return (await response.json()) as T;
  }

  return {
    baseUrl,
    siteSlug: options.siteSlug,
    host: options.host,

    getSite: () =>
      request<{ site: SiteSummary }>("/sites/current").then((r) => r.site),

    getCategories: () =>
      request<CategoriesResponse>("/catalog/categories").then(
        (r) => r.categories,
      ),

    getProducts: (params: {
      query?: string;
      category?: string;
      limit?: number;
    } = {}) => {
      const search = new URLSearchParams();
      if (params.query) search.set("q", params.query);
      if (params.category) search.set("category", params.category);
      if (params.limit) search.set("limit", String(params.limit));
      const qs = search.toString();
      return request<ProductListResponse>(
        `/catalog/products${qs ? `?${qs}` : ""}`,
      );
    },

    getProduct: (slug: string) =>
      request<ProductDetailResponse>(
        `/catalog/products/${encodeURIComponent(slug)}`,
      ),

    /** Site, header/footer section groups and the live theme in one call. */
    getLayout: (locale?: string) =>
      request<LayoutResponse>(`/render/layout${qs({ locale })}`),

    /** Published template for a resource kind; null when the site has none. */
    getTemplate: (kind: TemplateKind, params: { handle?: string; locale?: string } = {}) =>
      orNull(request<TemplateResponse>(`/render/templates/${encodeURIComponent(kind)}${qs(params)}`)),

    /** Verified domains; the primary one is the canonical host. */
    getDomains: () => request<DomainsResponse>("/render/domains"),

    /** Every indexable URL of the site (products, categories, published pages). */
    getSitemap: () => request<SitemapResponse>("/render/sitemap"),

    /** Legacy URL redirect for an exact path; null when none. */
    getRedirect: (path: string) => orNull(request<RedirectResponse>(`/render/redirect${qs({ path })}`)),

    /** Starts a Stripe Checkout session; returns the URL to send the visitor to. */
    /** `cookie`: the visitor's session cookie, so the order is linked to their account. */
    checkout: (body: CheckoutRequest, cookie?: string | null) =>
      request<CheckoutResponse>("/checkout", {
        method: "POST",
        headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
        body: JSON.stringify(body),
      }),

    /** Published standalone page by slug; null when missing or unpublished. */
    getPage: (slug: string, locale?: string) =>
      orNull(
        request<PageResponse>(
          `/render/pages/${slug.split("/").map(encodeURIComponent).join("/")}${qs({ locale })}`,
        ),
      ),
  };
}

export type StorefrontClient = ReturnType<typeof createStorefrontClient>;
