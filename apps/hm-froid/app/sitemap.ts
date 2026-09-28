import type { MetadataRoute } from "next";
import { db, product, store } from "@peltier/db";
import { and, eq } from "drizzle-orm";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = (
    process.env.STOREFRONT_URL?.trim() || "https://hmfroid.be"
  ).replace(/\/$/, "");
  const storeSlug = process.env.STOREFRONT_STORE_SLUG?.trim() || "hm-froid";
  const currentStore = await db.query.store.findFirst({
    where: eq(store.slug, storeSlug),
  });
  const products = currentStore
    ? await db
        .select({ slug: product.slug, updatedAt: product.updatedAt })
        .from(product)
        .where(
          and(
            eq(product.storeId, currentStore.id),
            eq(product.isArchived, false),
          ),
        )
    : [];

  return [
    { url: origin, changeFrequency: "weekly", priority: 1 },
    { url: `${origin}/shop`, changeFrequency: "daily", priority: 0.9 },
    ...products.map((item) => ({
      url: `${origin}/shop/${item.slug}`,
      lastModified: item.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
