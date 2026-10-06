import { Elysia, t } from "elysia";
import { db } from "@qubo/db/client";
import {
  category,
  inventoryItem,
  product,
  productCategory,
  productImage,
  productVariant,
} from "@qubo/db/schema";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { tenancy } from "../plugins/tenancy";
import { keyOf, resolvePrices } from "../lib/pricing";

export const catalog = new Elysia({ prefix: "/catalog" })
  .use(tenancy)
  .get(
    "/categories",
    async ({ site, status }) => {
      if (!site) return status(400, { error: "site_not_resolved" });

      const rows = await db
        .select({
          id: category.id,
          name: category.name,
          slug: category.slug,
          parentId: category.parentId,
          position: category.position,
        })
        .from(category)
        .where(eq(category.siteId, site.id))
        .orderBy(asc(category.position), asc(category.name));

      return { site: site.slug, categories: rows };
    },
    { detail: { summary: "Category tree for the resolved site" } },
  )
  .get(
    "/products",
    async ({ site, actor, query, status }) => {
      if (!site) return status(400, { error: "site_not_resolved" });

      const limit = Math.min(Number(query.limit ?? 48), 100);
      const conditions = [
        eq(product.siteId, site.id),
        eq(product.isArchived, false),
      ];

      if (query.q) {
        const term = `%${query.q.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
        conditions.push(
          or(
            ilike(product.name, term),
            ilike(product.description, term),
            ilike(product.brand, term),
          )!,
        );
      }

      if (query.category) {
        const [matched] = await db
          .select({ id: category.id })
          .from(category)
          .where(
            and(
              eq(category.siteId, site.id),
              eq(category.slug, query.category),
            ),
          )
          .limit(1);

        if (!matched) return { site: site.slug, products: [] };

        const memberships = await db
          .select({ productId: productCategory.productId })
          .from(productCategory)
          .where(eq(productCategory.categoryId, matched.id));

        if (!memberships.length) return { site: site.slug, products: [] };
        conditions.push(
          inArray(
            product.id,
            memberships.map((row) => row.productId),
          ),
        );
      }

      const rows = await db
        .select({
          id: product.id,
          slug: product.slug,
          name: product.name,
          description: product.description,
          brand: product.brand,
          basePrice: product.basePrice,
          compareAtPrice: product.compareAtPrice,
          image: productImage.url,
        })
        .from(product)
        .leftJoin(
          productImage,
          and(eq(productImage.productId, product.id), eq(productImage.position, 0)),
        )
        .where(and(...conditions))
        .orderBy(desc(product.isFeatured), desc(product.createdAt))
        .limit(limit);

      const prices = await resolvePrices(
        site.id,
        actor?.id ?? null,
        rows.map((row) => ({ productId: row.id, basePrice: row.basePrice })),
      );

      return {
        site: site.slug,
        currency: site.currency,
        products: rows.map((row) => {
          const price = prices.get(keyOf({ productId: row.id }))!;
          return {
            id: row.id,
            slug: row.slug,
            name: row.name,
            description: row.description,
            brand: row.brand,
            image: row.image,
            compareAtPrice: row.compareAtPrice,
            price: price.amount,
            priceSource: price.source,
          };
        }),
      };
    },
    {
      query: t.Object({
        q: t.Optional(t.String()),
        category: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
      detail: { summary: "Storefront product listing with resolved pricing" },
    },
  )
  .get(
    "/products/:slug",
    async ({ site, actor, params, status }) => {
      if (!site) return status(400, { error: "site_not_resolved" });

      const [item] = await db
        .select()
        .from(product)
        .where(
          and(
            eq(product.siteId, site.id),
            eq(product.slug, params.slug),
            eq(product.isArchived, false),
          ),
        )
        .limit(1);

      if (!item) return status(404, { error: "product_not_found" });

      const [images, variants, categories] = await Promise.all([
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
            price: productVariant.price,
            available: sql<number | null>`case
              when ${inventoryItem.tracked}
              then greatest(${inventoryItem.quantity} - ${inventoryItem.reservedQuantity}, 0)
              else null
            end`,
          })
          .from(productVariant)
          .leftJoin(inventoryItem, eq(inventoryItem.variantId, productVariant.id))
          .where(eq(productVariant.productId, item.id))
          .orderBy(asc(productVariant.position)),
        db
          .select({ name: category.name, slug: category.slug })
          .from(productCategory)
          .innerJoin(category, eq(category.id, productCategory.categoryId))
          .where(eq(productCategory.productId, item.id))
          .orderBy(asc(category.position)),
      ]);

      const prices = await resolvePrices(
        site.id,
        actor?.id ?? null,
        variants.map((variant) => ({
          productId: item.id,
          variantId: variant.id,
          basePrice: item.basePrice,
          variantPrice: variant.price,
        })),
      );

      return {
        site: site.slug,
        currency: site.currency,
        product: {
          ...item,
          images,
          categories,
          variants: variants.map((variant) => {
            const price = prices.get(
              keyOf({ productId: item.id, variantId: variant.id }),
            )!;
            return {
              id: variant.id,
              name: variant.name,
              sku: variant.sku,
              available: variant.available,
              price: price.amount,
              priceSource: price.source,
            };
          }),
        },
      };
    },
    { detail: { summary: "Product detail with per-variant resolved pricing" } },
  );
