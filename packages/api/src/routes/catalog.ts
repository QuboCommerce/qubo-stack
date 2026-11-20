import { Elysia, t } from "elysia";
import { db } from "@qubo/db/client";
import {
  category,
  collection,
  inventoryItem,
  product,
  productCategory,
  productImage,
  productVariant,
  productVariantImage,
} from "@qubo/db/schema";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { collectionCondition, collectionOrderBy } from "@qubo/db/collection-rules";
import { tenancy } from "../plugins/tenancy";
import { keyOf, resolvePrices } from "../lib/pricing";

const collectionColumns = {
  id: collection.id,
  name: collection.name,
  slug: collection.slug,
  description: collection.description,
  image: collection.image,
  metaTitle: collection.metaTitle,
  metaDescription: collection.metaDescription,
  kind: collection.kind,
  match: collection.match,
  rules: collection.rules,
  sort: collection.sort,
};

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
          description: category.description,
          // Qualify columns by hand: Drizzle drops the table prefix in a single-table select, so a bare "id" bound to product.id and every count was 0
          productCount: sql<number>`(
            select count(*)::int from ${productCategory}
            join ${product} on ${product}.id = ${productCategory}.product_id
            where ${productCategory}.category_id = ${category}.id and ${product}.is_archived = false
          )`,
        })
        .from(category)
        .where(eq(category.siteId, site.id))
        .orderBy(asc(category.position), asc(category.name));

      return { site: site.slug, categories: rows };
    },
    { detail: { summary: "Category tree for the resolved site" } },
  )
  .get(
    "/collections",
    async ({ site, status }) => {
      if (!site) return status(400, { error: "site_not_resolved" });

      const rows = await db
        .select(collectionColumns)
        .from(collection)
        .where(and(eq(collection.siteId, site.id), eq(collection.isPublished, true)))
        .orderBy(asc(collection.position), asc(collection.name));

      // One count per collection: rules differ per row, and a site has a handful of collections.
      const counts = await Promise.all(
        rows.map((c) =>
          db
            .select({ n: sql<number>`count(*)::int` })
            .from(product)
            .where(and(eq(product.siteId, site.id), eq(product.isArchived, false), collectionCondition(c)))
            .then(([r]) => r?.n ?? 0),
        ),
      );

      return {
        site: site.slug,
        collections: rows.map((c, i) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          image: c.image,
          metaTitle: c.metaTitle,
          metaDescription: c.metaDescription,
          productCount: counts[i]!,
        })),
      };
    },
    { detail: { summary: "Published collections of the resolved site, with product counts" } },
  )
  .get(
    "/products",
    async ({ site, actor, query, status }) => {
      if (!site) return status(400, { error: "site_not_resolved" });

      const limit = Math.min(Number(query.limit ?? 48), 100);
      let order: SQL[] = [desc(product.isFeatured), desc(product.createdAt)];
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

      if (query.onSale === "1") {
        conditions.push(sql`${product.compareAtPrice} > ${product.basePrice}`);
      }

      if (query.category) {
        // A collection shows its whole subtree: imported catalogues attach
        // products to leaves, and the root ("Froid commercial") must not be empty.
        const tree = await db
          .select({ id: category.id, parentId: category.parentId, slug: category.slug })
          .from(category)
          .where(eq(category.siteId, site.id));
        const root = tree.find((c) => c.slug === query.category);
        if (!root) return { site: site.slug, products: [] };
        const ids = [root.id];
        for (let i = 0; i < ids.length; i++) for (const c of tree) if (c.parentId === ids[i] && !ids.includes(c.id)) ids.push(c.id);
        conditions.push(
          inArray(
            product.id,
            db.select({ id: productCategory.productId }).from(productCategory).where(inArray(productCategory.categoryId, ids)),
          ),
        );
      } else if (query.collection) {
        // Unpublished or unknown collections list nothing, like an unknown category.
        const [found] = await db
          .select(collectionColumns)
          .from(collection)
          .where(and(eq(collection.siteId, site.id), eq(collection.slug, query.collection), eq(collection.isPublished, true)))
          .limit(1);
        if (!found) return { site: site.slug, currency: site.currency, products: [] };
        conditions.push(collectionCondition(found));
        // A search inside a collection keeps the default order; otherwise the collection's own sort.
        if (!query.q) order = collectionOrderBy(found);
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
        .orderBy(...order)
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
        /** Published collection slug; ignored when `category` is set. */
        collection: t.Optional(t.String()),
        /** "1" keeps products whose compare-at price is above the base price. */
        onSale: t.Optional(t.String()),
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

      const variantImages = variants.length
        ? await db
            .select({ variantId: productVariantImage.variantId, url: productImage.url })
            .from(productVariantImage)
            .innerJoin(productImage, eq(productImage.id, productVariantImage.productImageId))
            .where(inArray(productVariantImage.variantId, variants.map((v) => v.id)))
            .orderBy(asc(productImage.position))
        : [];

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
              // Gallery URLs for this variant; empty means "use the product images".
              images: variantImages.filter((v) => v.variantId === variant.id).map((v) => v.url),
              price: price.amount,
              priceSource: price.source,
            };
          }),
        },
      };
    },
    { detail: { summary: "Product detail with per-variant resolved pricing" } },
  );
