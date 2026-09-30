import { db } from "@peltier/db/client";
import {
  customerGroupMember,
  priceList,
  priceListPrice,
} from "@peltier/db/schema";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

/**
 * B2B price resolution.
 *
 * HM Froid sells to Horeca resellers at group-specific prices, so "the price"
 * depends on who is asking. Precedence, most to least specific:
 *
 *   1. price_list_price for the exact variant
 *   2. price_list_price for the product
 *   3. variant.price override
 *   4. product.basePrice
 *
 * This is the single reason the API exists. Reimplementing it per storefront
 * is how resellers end up billed retail.
 */

export type PriceInput = {
  productId: string;
  variantId?: string | null;
  basePrice: string;
  variantPrice?: string | null;
};

export type ResolvedPrice = {
  amount: string;
  source: "price-list-variant" | "price-list-product" | "variant" | "base";
  priceListId: string | null;
};

/** Active price lists that apply to this user, most specific group first. */
export async function getApplicablePriceLists(
  siteId: string,
  userId: string | null,
) {
  const groupIds = userId
    ? (
        await db
          .select({ groupId: customerGroupMember.groupId })
          .from(customerGroupMember)
          .where(eq(customerGroupMember.userId, userId))
      ).map((row) => row.groupId)
    : [];

  const groupCondition = groupIds.length
    ? or(
        inArray(priceList.customerGroupId, groupIds),
        isNull(priceList.customerGroupId),
      )!
    : isNull(priceList.customerGroupId);

  return db
    .select({
      id: priceList.id,
      customerGroupId: priceList.customerGroupId,
      currency: priceList.currency,
      includesTax: priceList.includesTax,
    })
    .from(priceList)
    .where(
      and(
        eq(priceList.siteId, siteId),
        eq(priceList.isActive, true),
        groupCondition,
        // Compared in SQL so validity windows use the database clock.
        or(isNull(priceList.startsAt), sql`${priceList.startsAt} <= now()`)!,
        or(isNull(priceList.endsAt), sql`${priceList.endsAt} >= now()`)!,
      ),
    )
    // A group-specific list must win over the catch-all default list.
    .orderBy(sql`case when ${priceList.customerGroupId} is null then 1 else 0 end`);
}

/**
 * Resolves prices for many items in two queries rather than N per item,
 * because product listings resolve 48+ prices per page.
 */
export async function resolvePrices(
  siteId: string,
  userId: string | null,
  items: PriceInput[],
): Promise<Map<string, ResolvedPrice>> {
  const result = new Map<string, ResolvedPrice>();
  if (!items.length) return result;

  const fallback = (item: PriceInput): ResolvedPrice =>
    item.variantPrice
      ? { amount: item.variantPrice, source: "variant", priceListId: null }
      : { amount: item.basePrice, source: "base", priceListId: null };

  const lists = await getApplicablePriceLists(siteId, userId);
  if (!lists.length) {
    for (const item of items) result.set(keyOf(item), fallback(item));
    return result;
  }

  const listIds = lists.map((list) => list.id);
  const productIds = [...new Set(items.map((item) => item.productId))];
  const variantIds = [
    ...new Set(items.map((item) => item.variantId).filter(Boolean)),
  ] as string[];

  const rows = await db
    .select({
      priceListId: priceListPrice.priceListId,
      productId: priceListPrice.productId,
      variantId: priceListPrice.variantId,
      amount: priceListPrice.amount,
    })
    .from(priceListPrice)
    .where(
      and(
        inArray(priceListPrice.priceListId, listIds),
        or(
          variantIds.length
            ? inArray(priceListPrice.variantId, variantIds)
            : sql`false`,
          inArray(priceListPrice.productId, productIds),
        )!,
      ),
    );

  // Rank lists so the most specific one wins deterministically.
  const rank = new Map(listIds.map((id, index) => [id, index]));

  for (const item of items) {
    const key = keyOf(item);
    let best: ResolvedPrice | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const row of rows) {
      const listRank = rank.get(row.priceListId);
      if (listRank === undefined) continue;

      const isVariantMatch =
        item.variantId && row.variantId === item.variantId;
      const isProductMatch = !row.variantId && row.productId === item.productId;
      if (!isVariantMatch && !isProductMatch) continue;

      // Variant matches always beat product matches within the same list.
      const score = listRank * 2 + (isVariantMatch ? 0 : 1);
      if (score < bestScore) {
        bestScore = score;
        best = {
          amount: row.amount,
          source: isVariantMatch ? "price-list-variant" : "price-list-product",
          priceListId: row.priceListId,
        };
      }
    }

    result.set(key, best ?? fallback(item));
  }

  return result;
}

export function keyOf(item: Pick<PriceInput, "productId" | "variantId">) {
  return item.variantId ? `v:${item.variantId}` : `p:${item.productId}`;
}
