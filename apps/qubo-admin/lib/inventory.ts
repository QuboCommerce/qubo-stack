import "server-only";

import { db } from "@qubo/db/client";
import { inventoryHistory, inventoryItem, product, productCategory, productImage, productVariant, user } from "@qubo/db/schema";
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";

export type StockStatus = "all" | "low" | "out" | "untracked";

export type InventoryFilter = {
  q?: string;
  status?: StockStatus;
  /** Products in any of these categories (pass a whole subtree); "none" for uncategorised. */
  categoryIds?: string[] | "none";
  productId?: string;
  page?: number;
  perPage?: number;
};

// A variant without an inventory_item row is not tracked.
const tracked = sql`coalesce(${inventoryItem.tracked}, false)`;
const available = sql`greatest(coalesce(${inventoryItem.quantity}, 0) - coalesce(${inventoryItem.reservedQuantity}, 0), 0)`;
const statusSql: Record<Exclude<StockStatus, "all">, SQL> = {
  low: sql`(${tracked} and ${available} > 0 and ${available} <= ${inventoryItem.lowStockThreshold})`,
  out: sql`(${tracked} and ${available} = 0)`,
  untracked: sql`(not ${tracked})`,
};

function baseConditions(siteId: string, filter: InventoryFilter) {
  const conds: SQL[] = [eq(productVariant.siteId, siteId), eq(product.siteId, siteId)];
  const q = filter.q?.trim();
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    conds.push(sql`(${product.name} ilike ${like} or ${productVariant.sku} ilike ${like} or ${productVariant.name} ilike ${like})`);
  }
  if (filter.productId) conds.push(eq(product.id, filter.productId));
  if (filter.categoryIds === "none") {
    conds.push(sql`not exists (select 1 from ${productCategory} pc where pc.product_id = ${product.id})`);
  } else if (filter.categoryIds) {
    const ids = filter.categoryIds.length ? filter.categoryIds : ["00000000-0000-0000-0000-000000000000"];
    conds.push(
      sql`exists (select 1 from ${productCategory} pc where pc.product_id = ${product.id} and pc.category_id in (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)}))`,
    );
  }
  return conds;
}

const countQuery = () =>
  db
    .select({
      all: sql<number>`count(*)::int`,
      low: sql<number>`(count(*) filter (where ${statusSql.low}))::int`,
      out: sql<number>`(count(*) filter (where ${statusSql.out}))::int`,
      untracked: sql<number>`(count(*) filter (where ${statusSql.untracked}))::int`,
    })
    .from(productVariant)
    .innerJoin(product, eq(product.id, productVariant.productId))
    .leftJoin(inventoryItem, eq(inventoryItem.variantId, productVariant.id));

/** Tab counts for a filter (status is ignored). */
export async function getInventoryCounts(siteId: string, filter: InventoryFilter = {}) {
  const [row] = await countQuery().where(and(...baseConditions(siteId, filter)));
  return row ?? { all: 0, low: 0, out: 0, untracked: 0 };
}

export async function getInventory(siteId: string, filter: InventoryFilter = {}) {
  const perPage = filter.perPage ?? 50;
  const page = Math.max(1, filter.page ?? 1);
  const conds = baseConditions(siteId, filter);
  if (filter.status && filter.status !== "all") conds.push(statusSql[filter.status]);
  const where = and(...conds);
  const [rows, [total]] = await Promise.all([
    db
      .select({
        variantId: productVariant.id,
        productId: product.id,
        productName: product.name,
        variantName: productVariant.name,
        sku: productVariant.sku,
        variantCount: sql<number>`(select count(*)::int from ${productVariant} v where v.product_id = ${product.id})`,
        image: sql<string | null>`(select pi.url from ${productImage} pi where pi.product_id = ${product.id} order by pi.position limit 1)`,
        quantity: sql<number>`coalesce(${inventoryItem.quantity}, 0)`,
        reserved: sql<number>`coalesce(${inventoryItem.reservedQuantity}, 0)`,
        threshold: sql<number>`coalesce(${inventoryItem.lowStockThreshold}, 5)`,
        tracked: sql<boolean>`${tracked}`,
      })
      .from(productVariant)
      .innerJoin(product, eq(product.id, productVariant.productId))
      .leftJoin(inventoryItem, eq(inventoryItem.variantId, productVariant.id))
      .where(where)
      .orderBy(asc(product.name), asc(product.id), asc(productVariant.position), asc(productVariant.id))
      .limit(perPage)
      .offset((page - 1) * perPage),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(productVariant)
      .innerJoin(product, eq(product.id, productVariant.productId))
      .leftJoin(inventoryItem, eq(inventoryItem.variantId, productVariant.id))
      .where(where),
  ]);
  return { rows, total: total?.value ?? 0, page, perPage };
}

export type InventoryRow = Awaited<ReturnType<typeof getInventory>>["rows"][number];

/** One variant's stock settings and its latest history, scoped to the site. */
export async function getInventoryDetail(siteId: string, variantId: string) {
  const [row] = await db
    .select({
      variantId: productVariant.id,
      productId: product.id,
      productName: product.name,
      variantName: productVariant.name,
      sku: productVariant.sku,
      itemId: inventoryItem.id,
      quantity: inventoryItem.quantity,
      reserved: inventoryItem.reservedQuantity,
      threshold: inventoryItem.lowStockThreshold,
      tracked: inventoryItem.tracked,
      supplier: inventoryItem.supplier,
      storageLocation: inventoryItem.storageLocation,
    })
    .from(productVariant)
    .innerJoin(product, eq(product.id, productVariant.productId))
    .leftJoin(inventoryItem, eq(inventoryItem.variantId, productVariant.id))
    .where(and(eq(productVariant.id, variantId), eq(productVariant.siteId, siteId), eq(product.siteId, siteId)))
    .limit(1);
  if (!row) return null;
  const history = row.itemId
    ? await db
        .select({
          id: inventoryHistory.id,
          adjustment: inventoryHistory.adjustment,
          reason: inventoryHistory.reason,
          referenceType: inventoryHistory.referenceType,
          referenceId: inventoryHistory.referenceId,
          createdAt: inventoryHistory.createdAt,
          by: user.name,
        })
        .from(inventoryHistory)
        .leftJoin(user, eq(user.id, inventoryHistory.createdBy))
        .where(eq(inventoryHistory.inventoryItemId, row.itemId))
        .orderBy(desc(inventoryHistory.createdAt))
        .limit(20)
    : [];
  return {
    variantId: row.variantId,
    productId: row.productId,
    productName: row.productName,
    variantName: row.variantName,
    sku: row.sku,
    quantity: row.quantity ?? 0,
    reserved: row.reserved ?? 0,
    threshold: row.threshold ?? 5,
    tracked: row.tracked ?? false,
    supplier: row.supplier ?? "",
    storageLocation: row.storageLocation ?? "",
    history: history.map((h) => ({ ...h, createdAt: h.createdAt.toISOString() })),
  };
}

export type InventoryDetail = NonNullable<Awaited<ReturnType<typeof getInventoryDetail>>>;
