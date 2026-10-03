import type {
  CategoriesResponse,
  ProductDetailResponse,
  ProductListResponse,
  SiteSummary,
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
  siteSlug: string;
  /**
   * Forwarded so the API can resolve the logged-in customer and therefore
   * their reseller price list. Without this every caller sees list price.
   */
  headers?: HeadersInit;
  fetch?: typeof fetch;
};

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

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await doFetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "x-qubo-site": options.siteSlug,
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
  };
}

export type StorefrontClient = ReturnType<typeof createStorefrontClient>;
