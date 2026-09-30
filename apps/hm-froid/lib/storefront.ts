import "server-only";

import {
  category,
  db,
  inventoryItem,
  product,
  productCategory,
  productImage,
  productVariant,
  site,
} from "@peltier/db";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";

export type StorefrontProduct = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  brand: string | null;
  price: string;
  compareAtPrice: string | null;
  image: string | null;
};

export type StorefrontVariant = {
  id: string;
  name: string;
  sku: string | null;
  price: string;
  available: number | null;
};

function getSiteSlug() {
  return process.env.STOREFRONT_SITE_SLUG?.trim() || "hm-froid";
}

export async function getSite() {
  return db.query.site.findFirst({
    where: eq(site.slug, getSiteSlug()),
  });
}

export async function getCategories() {
  const currentSite = await getSite();
  if (!currentSite) return [];

  return db
    .select({ name: category.name, slug: category.slug })
    .from(category)
    .where(eq(category.siteId, currentSite.id))
    .orderBy(asc(category.position), asc(category.name));
}

export async function getProducts(input: {
  query?: string;
  categorySlug?: string;
  limit?: number;
}) {
  const currentSite = await getSite();
  if (!currentSite) return [];

  const conditions = [
    eq(product.siteId, currentSite.id),
    eq(product.isArchived, false),
  ];

  if (input.query) {
    const term = `%${input.query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    conditions.push(
      or(
        ilike(product.name, term),
        ilike(product.description, term),
        ilike(product.brand, term),
      )!,
    );
  }

  if (input.categorySlug) {
    const matchingCategory = await db.query.category.findFirst({
      where: and(
        eq(category.siteId, currentSite.id),
        eq(category.slug, input.categorySlug),
      ),
    });
    if (!matchingCategory) return [];

    const memberships = await db
      .select({ productId: productCategory.productId })
      .from(productCategory)
      .where(eq(productCategory.categoryId, matchingCategory.id));
    if (!memberships.length) return [];
    conditions.push(inArray(product.id, memberships.map((row) => row.productId)));
  }

  const rows = await db
    .select({
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      brand: product.brand,
      price: product.basePrice,
      compareAtPrice: product.compareAtPrice,
      image: productImage.url,
    })
    .from(product)
    .leftJoin(
      productImage,
      and(
        eq(productImage.productId, product.id),
        eq(productImage.position, 0),
      ),
    )
    .where(and(...conditions))
    .orderBy(desc(product.isFeatured), desc(product.createdAt))
    .limit(Math.min(input.limit ?? 48, 100));

  return rows satisfies StorefrontProduct[];
}

export async function getProduct(slug: string) {
  const currentSite = await getSite();
  if (!currentSite) return null;

  const item = await db.query.product.findFirst({
    where: and(
      eq(product.siteId, currentSite.id),
      eq(product.slug, slug),
      eq(product.isArchived, false),
    ),
  });
  if (!item) return null;

  const [images, variants] = await Promise.all([
    db
      .select({ url: productImage.url, alt: productImage.alt })
      .from(productImage)
      .where(eq(productImage.productId, item.id))
      .orderBy(asc(productImage.position)),
    db
      .select({
        id: productVariant.id,
        name: productVariant.name,
        sku: productVariant.sku,
        price: sql<string>`coalesce(${productVariant.price}, ${item.basePrice})`,
        available: sql<number | null>`case
          when ${inventoryItem.tracked} then greatest(${inventoryItem.quantity} - ${inventoryItem.reservedQuantity}, 0)
          else null
        end`,
      })
      .from(productVariant)
      .leftJoin(inventoryItem, eq(inventoryItem.variantId, productVariant.id))
      .where(eq(productVariant.productId, item.id))
      .orderBy(asc(productVariant.position)),
  ]);

  return { ...item, images, variants: variants satisfies StorefrontVariant[] };
}

