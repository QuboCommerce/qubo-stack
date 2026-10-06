import type { Theme } from "@qubo/stylekit";
import type { LinkValue, MediaValue } from "./fields";

export const siteTypes = ["store", "services", "business", "editorial", "custom"] as const;
export type SiteType = (typeof siteTypes)[number];

/**
 * Feature flags a site has switched on. Blocks declare the capabilities they
 * need; the editor hides blocks whose capabilities are missing.
 */
export const capabilities = ["commerce", "catalog", "booking", "leads", "blog", "accounts", "locales"] as const;
export type Capability = (typeof capabilities)[number];

export type AssetInfo = {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
  mime?: string;
  blurDataUrl?: string;
};

/**
 * Everything a block may need at render time, passed as Puck `metadata` so it
 * works identically in the editor canvas and in RSC. Plain data only.
 */
export type RenderMetadata = {
  site?: { id: string; type: SiteType; capabilities: Capability[]; name?: string; currency?: string; locale?: string };
  locale?: string;
  /** URL prefix of the locale being rendered (`/nl`); empty for the primary language. */
  basePath?: string;
  /** Every published language of the site, with the current page's URL in each; drives the header switch. */
  locales?: LocaleLink[];
  theme?: Theme;
  /** Preview light/dark for dual-mode themes (Studio toggle). */
  mode?: "light" | "dark" | "system";
  /** assetId → delivery info, prefetched from `collectAssetIds()`. */
  assets?: Record<string, AssetInfo>;
  /** `page:about` / `product:slug` → href; unresolved links fall back to conventions. */
  links?: Record<string, string>;
  /** Pre-loaded data for dynamic blocks, keyed by node id. */
  data?: Record<string, unknown>;
  /** Render with schema placeholders instead of content (component inspector). */
  blueprint?: boolean;
};

export type LocaleLink = { locale: string; label: string; href: string; current: boolean };

export type BlockContext = {
  id: string;
  isEditing: boolean;
  metadata: RenderMetadata;
};

export type ResolvedMedia = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  objectPosition?: string;
};

export function resolveMedia(media: MediaValue | null | undefined, meta: RenderMetadata): ResolvedMedia | null {
  if (!media) return null;
  const asset = media.assetId ? meta.assets?.[media.assetId] : undefined;
  const src = asset?.url ?? media.url;
  if (!src) return null;
  const out: ResolvedMedia = { src, alt: media.alt || asset?.alt || "" };
  const width = asset?.width ?? media.width;
  const height = asset?.height ?? media.height;
  if (width) out.width = width;
  if (height) out.height = height;
  if (media.focal) out.objectPosition = `${Math.round(media.focal.x * 100)}% ${Math.round(media.focal.y * 100)}%`;
  return out;
}

/** A site-internal path under the locale prefix being rendered: `/cart` → `/nl/cart`. */
export function localHref(path: string, meta: RenderMetadata): string {
  const base = meta.basePath ?? "";
  if (!base || !path.startsWith("/") || path.startsWith("//")) return path;
  return path === "/" ? base : `${base}${path}`;
}

export function resolveLink(link: LinkValue | null | undefined, meta: RenderMetadata): string | undefined {
  if (!link || !link.value) return undefined;
  const v = link.value.trim();
  const mapped = meta.links?.[`${link.kind}:${v}`];
  if (mapped) return mapped;
  switch (link.kind) {
    case "url":
      return localHref(v, meta);
    case "anchor":
      return v.startsWith("#") ? v : `#${v}`;
    case "email":
      return `mailto:${v}`;
    case "phone":
      return `tel:${v.replace(/[^\d+]/g, "")}`;
    case "page":
      return localHref(v === "home" ? "/" : `/${v.replace(/^\//, "")}`, meta);
    case "product":
      return localHref(`/products/${v}`, meta);
    case "collection":
      return localHref(`/collections/${v}`, meta);
  }
}

export const linkTarget = (link: LinkValue | null | undefined) =>
  link?.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {};

/**
 * The plain string behind a text prop. In the editor, inline-editable fields
 * arrive as Puck's InlineTextField element carrying the raw `value`.
 */
export function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "props" in value) {
    const inner = (value as { props?: { value?: unknown } }).props?.value;
    if (typeof inner === "string") return inner;
  }
  return value == null ? "" : String(value);
}
