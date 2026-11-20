import "server-only";

import { db } from "@qubo/db/client";
import { collection, collectionProduct, product, productImage } from "@qubo/db/schema";
import { collectionCondition, collectionOrderBy, parseRules, type CollectionRule, type CollectionSort } from "@qubo/db/collection-rules";
import { and, asc, count, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { FormValues } from "@/lib/merge";
import { assetUrl } from "@/lib/format";

export const MAX_PICKS = 500;
export const PREVIEW_SIZE = 12;

/** The editor's unsaved state: what the preview and the save action read. */
export type CollectionDraft = {
  kind: "smart" | "manual";
  match: "all" | "any";
  rules: CollectionRule[];
  productIds: string[];
  sort: CollectionSort;
};

export type ProductCard = { id: string; name: string; reference: string | null; image: string | null; price: string };

// An id no row has: the draft's own picks are filtered by `productIds`, not by `collection_product`.
const DRAFT_ID = "00000000-0000-0000-0000-000000000000";

const visible = (siteId: string) => and(eq(product.siteId, siteId), eq(product.isArchived, false))!;

/** Reference as the shop knows it: the legacy "Référence", else the first variant SKU. */
const reference = sql<string | null>`coalesce(
  ${product.sourceSnapshot}->>'Référence',
  (select v.sku from product_variant v where v.product_id = "product"."id" and v.sku is not null order by v.position limit 1),
  ${product.legacyId}
)`;

export async function productCards(where: SQL, orderBy: SQL[], limit: number): Promise<ProductCard[]> {
  const rows = await db
    .select({
      id: product.id,
      name: product.name,
      reference,
      image: sql<string | null>`(select pi.url from ${productImage} pi where pi.product_id = "product"."id" order by pi.position limit 1)`,
      price: product.basePrice,
    })
    .from(product)
    .where(where)
    .orderBy(...orderBy)
    .limit(limit);
  return rows.map((r) => ({ ...r, image: assetUrl(r.image) }));
}

export function draftWhere(siteId: string, d: CollectionDraft): SQL {
  if (d.kind === "manual") {
    return d.productIds.length ? and(visible(siteId), inArray(product.id, d.productIds))! : sql`false`;
  }
  return and(visible(siteId), collectionCondition({ id: DRAFT_ID, kind: "smart", match: d.match, rules: d.rules, sort: d.sort }))!;
}

export function draftOrder(d: CollectionDraft): SQL[] {
  if (d.kind === "manual" && d.sort === "manual" && d.productIds.length) {
    const ids = sql.join(d.productIds.map((id) => sql`${id}::uuid`), sql`, `);
    return [sql`array_position(array[${ids}], "product"."id")`];
  }
  return collectionOrderBy({ id: DRAFT_ID, kind: d.kind, sort: d.sort });
}

export async function previewDraft(siteId: string, d: CollectionDraft) {
  const where = draftWhere(siteId, d);
  const [items, [total]] = await Promise.all([
    productCards(where, draftOrder(d), PREVIEW_SIZE),
    db.select({ value: count() }).from(product).where(where),
  ]);
  return { count: total?.value ?? 0, items };
}

type CollectionRow = typeof collection.$inferSelect;

/** Live product count of saved collections, keyed by id. */
export async function collectionCounts(siteId: string, rows: CollectionRow[]) {
  const counts = await Promise.all(
    rows.map((c) =>
      db
        .select({ value: count() })
        .from(product)
        .where(and(visible(siteId), collectionCondition(c)))
        .then(([r]) => [c.id, r?.value ?? 0] as const),
    ),
  );
  return new Map(counts);
}

export async function pickedIds(collectionId: string) {
  const rows = await db
    .select({ id: collectionProduct.productId })
    .from(collectionProduct)
    .where(eq(collectionProduct.collectionId, collectionId))
    .orderBy(asc(collectionProduct.position));
  return rows.map((r) => r.id);
}

/** Field values exactly as the collection editor renders and submits them. */
export function collectionValues(c: CollectionRow, productIds: string[]): FormValues {
  return {
    name: c.name,
    slug: c.slug,
    description: c.description ?? "",
    image: c.image ?? "",
    metaTitle: c.metaTitle ?? "",
    metaDescription: c.metaDescription ?? "",
    kind: c.kind,
    match: c.match,
    rules: JSON.stringify(parseRules(c.rules)),
    productIds: JSON.stringify(productIds),
    sort: c.sort,
    isPublished: c.isPublished ? "on" : "",
  };
}

/** Product cards for ids already picked, in the given order (the editor's initial list). */
export async function pickedCards(siteId: string, ids: string[]) {
  if (!ids.length) return [];
  const cards = await productCards(and(eq(product.siteId, siteId), inArray(product.id, ids))!, [], ids.length);
  const byId = new Map(cards.map((c) => [c.id, c]));
  return ids.map((i) => byId.get(i)).filter((c) => c !== undefined);
}
