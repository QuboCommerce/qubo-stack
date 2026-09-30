import type { MetadataRoute } from "next";
import { db, product, site } from "@peltier/db";
import { and, eq } from "drizzle-orm";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = (
    process.env.STOREFRONT_URL?.trim() || "https://hmfroid.be"
  ).replace(/\/$/, "");
  const siteSlug = process.env.STOREFRONT_SITE_SLUG?.trim() || "hm-froid";
  const currentSite = await db.query.site.findFirst({
    where: eq(site.slug, siteSlug),
  });
  const products = currentSite
    ? await db
        .select({ slug: product.slug, updatedAt: product.updatedAt })
        .from(product)
        .where(
          and(
            eq(product.siteId, currentSite.id),
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
