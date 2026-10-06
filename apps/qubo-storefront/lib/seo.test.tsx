import { describe, expect, it } from "bun:test";
import type { Storefront } from "./site";
import { breadcrumbLd, categoryCrumbs, localBusinessLd, plainText, productLd } from "./seo";

const sf = {
  origin: "https://example.test",
  site: { id: "s", slug: "ex", name: "Example", type: "store", currency: "EUR", locale: "fr-BE", organizationId: "o", capabilities: [] },
  seo: { title: "Example, matériel horeca", description: null },
  business: { legalName: null, companyNumber: null, vatNumber: null, phone: "+32 2 000 00 00", email: null, address: null, openingHours: [], geo: null, type: "Store" },
  theme: undefined,
} as unknown as Storefront;

describe("seo", () => {
  it("strips tags and cuts at a word", () => {
    expect(plainText("<p>Hello&nbsp;<b>world</b> &amp; friends</p>")).toBe("Hello world & friends");
    expect(plainText("one two three four five six", 14)).toBe("one two three…");
    expect(plainText("")).toBeUndefined();
  });

  it("skips the business node without an address and walks category ancestry", () => {
    expect(localBusinessLd(sf)).toBeNull();
    const cats = [
      { id: "1", name: "Froid", slug: "froid", parentId: null, position: 0 },
      { id: "2", name: "Monobloc", slug: "monobloc", parentId: "1", position: 0 },
    ];
    const crumbs = categoryCrumbs(cats, "monobloc");
    expect(crumbs.map((c) => c.path)).toEqual(["/collections/froid", "/collections/monobloc"]);
    const ld = breadcrumbLd(sf, crumbs);
    expect(ld.itemListElement[0]).toEqual({ "@type": "ListItem", position: 1, name: "Accueil", item: "https://example.test/" });
    expect(ld.itemListElement).toHaveLength(3);
  });

  it("emits an Offer for one variant and an AggregateOffer for several", () => {
    const base = { id: "p", slug: "p", name: "P", description: "<p>d</p>", brand: "MBM", basePrice: "10.00", compareAtPrice: null, images: [{ url: "/api/media/x.webp", alt: null }], metaTitle: null, metaDescription: null, categories: [{ name: "Cat", slug: "cat" }] };
    const one = productLd(sf, { ...base, variants: [{ id: "v", name: null, sku: "SKU1", available: 0, price: "10.00", priceSource: "base" }] }) as any;
    expect(one.offers["@type"]).toBe("Offer");
    expect(one.offers.availability).toBe("https://schema.org/OutOfStock");
    expect(one.sku).toBe("SKU1");
    expect(one.image).toEqual(["https://example.test/api/media/x.webp"]);
    const many = productLd(sf, {
      ...base,
      variants: [
        { id: "a", name: "A", sku: null, available: null, price: "10.00", priceSource: "base" },
        { id: "b", name: "B", sku: null, available: null, price: "25.50", priceSource: "variant" },
      ],
    }) as any;
    expect(many.offers).toMatchObject({ "@type": "AggregateOffer", lowPrice: "10", highPrice: "25.5", offerCount: 2, availability: "https://schema.org/InStock" });
    expect(many.sku).toBeUndefined();
  });
});
