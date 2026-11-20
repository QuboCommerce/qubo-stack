import { db } from "@qubo/db/client";
import { customerGroupMember, discount, discountCondition, discountUsage, productCategory } from "@qubo/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { normalizeCode, type DiscountRule, type DiscountShopper } from "./discount-rules";

export * from "./discount-rules";

/** The rule behind a code on a site, or null when no such code exists. */
export async function loadDiscount(siteId: string, code: string): Promise<DiscountRule | null> {
  const [row] = await db
    .select()
    .from(discount)
    .where(and(eq(discount.siteId, siteId), sql`upper(${discount.code}) = ${normalizeCode(code)}`))
    .limit(1);
  if (!row) return null;
  const conditions = await db.select().from(discountCondition).where(eq(discountCondition.discountId, row.id));
  const targets = (type: (typeof conditions)[number]["type"]) => {
    const ids = conditions.filter((c) => c.type === type).flatMap((c) => c.targetIds);
    return ids.length ? ids : null;
  };
  const minQty = targets("MIN_QUANTITY");
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    value: row.value,
    minPurchaseAmount: row.minPurchaseAmount,
    maxUsesTotal: row.maxUsesTotal,
    maxUsesPerCustomer: row.maxUsesPerCustomer,
    usedCount: row.usedCount,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    isActive: row.isActive,
    productIds: targets("SPECIFIC_PRODUCTS"),
    categoryIds: targets("SPECIFIC_CATEGORIES"),
    minQuantity: minQty ? Math.max(...minQty.map(Number).filter(Number.isFinite)) : null,
    customerGroupIds: targets("CUSTOMER_GROUP"),
  };
}

/** Category ids per product, for category-scoped codes. */
/** Each product's categories plus their ancestors, so a code on a parent covers its subtree. */
export async function categoriesOf(productIds: string[]) {
  const map = new Map<string, string[]>();
  if (!productIds.length) return map;
  const rows = await db.execute<{ product_id: string; category_id: string }>(sql`
    with recursive up(product_id, category_id) as (
      select ${productCategory.productId}, ${productCategory.categoryId} from ${productCategory}
      where ${inArray(productCategory.productId, productIds)}
      union
      select up.product_id, c.parent_id from up join category c on c.id = up.category_id where c.parent_id is not null
    )
    select product_id, category_id::text from up`);
  for (const r of rows) map.set(r.product_id, [...(map.get(r.product_id) ?? []), r.category_id]);
  return map;
}

export async function shopperFor(discountId: string, userId: string | null): Promise<DiscountShopper> {
  if (!userId) return { signedIn: false, groupIds: [], usesByCustomer: 0 };
  const [groups, [uses]] = await Promise.all([
    db.select({ id: customerGroupMember.groupId }).from(customerGroupMember).where(eq(customerGroupMember.userId, userId)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(discountUsage)
      .where(and(eq(discountUsage.discountId, discountId), eq(discountUsage.customerId, userId))),
  ]);
  return { signedIn: true, groupIds: groups.map((g) => g.id), usesByCustomer: uses?.n ?? 0 };
}
