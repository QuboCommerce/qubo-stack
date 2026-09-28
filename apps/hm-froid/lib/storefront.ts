import "server-only";

import {
  category,
  db,
  inventoryItem,
  product,
  productCategory,
  productImage,
  productVariant,
  store,
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

function getStoreSlug() {
  return process.env.STOREFRONT_STORE_SLUG?.trim() || "hm-froid";
}

export async function getStore() {
  return db.query.store.findFirst({
    where: eq(store.slug, getStoreSlug()),
  });
}

export async function getCategories() {
  const currentStore = await getStore();
  if (!currentStore) return [];

  return db
    .select({ name: category.name, slug: category.slug })
    .from(category)
    .where(eq(category.storeId, currentStore.id))
    .orderBy(asc(category.position), asc(category.name));
}

export async function getProducts(input: {
  query?: string;
  categorySlug?: string;
  limit?: number;
}) {
  const currentStore = await getStore();
  if (!currentStore) return [];

  const conditions = [
    eq(product.storeId, currentStore.id),
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
        eq(category.storeId, currentStore.id),
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
  const currentStore = await getStore();
  if (!currentStore) return null;

  const item = await db.query.product.findFirst({
    where: and(
      eq(product.storeId, currentStore.id),
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

