import type { CategoryNode, ProductDetail } from "@qubo/storefront";
import type { Storefront } from "./site";

/**
 * Structured data (schema.org JSON-LD) and title rules, the same for every
 * site. Everything here reads what the merchant filled in under Settings:
 * nothing is invented, missing fields are simply left out.
 */

export type Crumb = { name: string; path: string };

/** The site-wide title: Settings meta title, else the site name. Also the suffix of every page title. */
export const siteTitle = (sf: Storefront) => sf.seo.title || sf.site.name;

/** Plain text for descriptions: tags stripped, whitespace folded, cut at a word boundary. */
export function plainText(html: string | null | undefined, max = 300): string | undefined {
  if (!html) return undefined;
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return undefined;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = text[max] === " " ? max : cut.lastIndexOf(" ");
  return `${text.slice(0, end > max - 40 ? end : max - 1)}…`;
}

/** "Home" in the site's language, for the first breadcrumb. */
export function homeLabel(locale: string) {
  const lang = locale.split("-")[0];
  return lang === "fr" ? "Accueil" : lang === "nl" ? "Home" : lang === "de" ? "Startseite" : "Home";
}

const absolute = (sf: Storefront, url: string | undefined | null) => (url ? new URL(url, sf.origin).toString() : undefined);

const compact = <T extends Record<string, unknown>>(obj: T): T => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== "")) as T;

export function JsonLd({ data }: { data: object | object[] }) {
  // "<" is escaped so no value can close the script element.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

const organizationId = (sf: Storefront) => `${sf.origin}/#organization`;

const dayName: Record<string, string> = { mo: "Monday", tu: "Tuesday", we: "Wednesday", th: "Thursday", fr: "Friday", sa: "Saturday", su: "Sunday" };

function postalAddress(sf: Storefront) {
  const a = sf.business.address;
  if (!a) return undefined;
  return compact({
    "@type": "PostalAddress",
    streetAddress: [a.line1, a.line2].filter(Boolean).join(", ") || undefined,
    postalCode: a.postalCode,
    addressLocality: a.city,
    addressCountry: a.country,
  });
}

/** Who publishes the site. Always emitted; the legal entity fields appear once they are filled in. */
export function organizationLd(sf: Storefront) {
  const brand = sf.theme?.brand;
  return compact({
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": organizationId(sf),
    name: sf.site.name,
    legalName: sf.business.legalName,
    url: `${sf.origin}/`,
    logo: absolute(sf, brand?.logo?.url || brand?.mark?.url),
    telephone: sf.business.phone,
    email: sf.business.email,
    vatID: sf.business.vatNumber,
    taxID: sf.business.companyNumber,
    address: postalAddress(sf),
  });
}

export function webSiteLd(sf: Storefront) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${sf.origin}/#website`,
    name: sf.site.name,
    url: `${sf.origin}/`,
    inLanguage: sf.site.locale,
    publisher: { "@id": organizationId(sf) },
  };
}

/** The physical place: only when there is an address, since that is what makes it local. */
export function localBusinessLd(sf: Storefront) {
  const b = sf.business;
  if (!b.address) return null;
  const brand = sf.theme?.brand;
  return compact({
    "@context": "https://schema.org",
    "@type": b.type || "LocalBusiness",
    "@id": `${sf.origin}/#business`,
    name: sf.site.name,
    url: `${sf.origin}/`,
    image: absolute(sf, brand?.ogImage?.url || brand?.logo?.url),
    telephone: b.phone,
    email: b.email,
    address: postalAddress(sf),
    geo: b.geo ? { "@type": "GeoCoordinates", latitude: b.geo.latitude, longitude: b.geo.longitude } : undefined,
    openingHoursSpecification: b.openingHours.length
      ? b.openingHours.map((rule) => ({
          "@type": "OpeningHoursSpecification",
          dayOfWeek: rule.days.map((d) => dayName[d] ?? d),
          opens: rule.opens,
          closes: rule.closes,
        }))
      : undefined,
    parentOrganization: { "@id": organizationId(sf) },
  });
}

/** Site-wide graph for the layout: organisation, website and (when located) the business. */
export function siteLd(sf: Storefront) {
  return [organizationLd(sf), webSiteLd(sf), localBusinessLd(sf)].filter((n): n is NonNullable<typeof n> => Boolean(n));
}

export function breadcrumbLd(sf: Storefront, crumbs: Crumb[]) {
  const items = [{ name: homeLabel(sf.site.locale), path: "/" }, ...crumbs];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: `${sf.origin}${c.path}` })),
  };
}

/** Category ancestry as breadcrumbs, root first. */
export function categoryCrumbs(categories: CategoryNode[], slug: string): Crumb[] {
  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  const byId = new Map(categories.map((c) => [c.id, c]));
  const chain: Crumb[] = [];
  let node = bySlug.get(slug);
  for (let guard = 0; node && guard < 20; guard++) {
    chain.unshift({ name: node.name, path: `/collections/${encodeURIComponent(node.slug)}` });
    node = node.parentId ? byId.get(node.parentId) : undefined;
  }
  return chain;
}

export function productLd(sf: Storefront, product: ProductDetail) {
  const url = `${sf.origin}/products/${encodeURIComponent(product.slug)}`;
  const inStock = (available: number | null) => (available === null || available > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock");
  const variants = product.variants.length ? product.variants : [{ id: product.id, name: null, sku: null, available: null, price: product.basePrice, priceSource: "base" as const }];
  const prices = variants.map((v) => Number(v.price)).filter((n) => Number.isFinite(n));
  const offers =
    variants.length === 1
      ? compact({
          "@type": "Offer",
          url,
          price: variants[0]!.price,
          priceCurrency: sf.site.currency,
          availability: inStock(variants[0]!.available),
          sku: variants[0]!.sku,
          seller: { "@id": organizationId(sf) },
        })
      : {
          "@type": "AggregateOffer",
          url,
          lowPrice: String(Math.min(...prices)),
          highPrice: String(Math.max(...prices)),
          priceCurrency: sf.site.currency,
          offerCount: variants.length,
          availability: variants.some((v) => v.available === null || (v.available ?? 0) > 0) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          seller: { "@id": organizationId(sf) },
        };
  return compact({
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: product.name,
    description: plainText(product.description, 500),
    image: product.images.length ? product.images.map((i) => absolute(sf, i.url)) : undefined,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    sku: product.variants.length === 1 ? (product.variants[0]?.sku ?? undefined) : undefined,
    category: product.categories[0]?.name,
    url,
    offers,
  });
}
