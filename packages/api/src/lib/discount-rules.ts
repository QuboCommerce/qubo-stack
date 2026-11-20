/**
 * Discount codes. `evaluateDiscount` is pure so the rules can be tested without a
 * database; `discounts.ts` loads what it needs. The checkout re-evaluates at
 * payment time, so a code checked in the cart can still be refused later.
 */
export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING";

export type DiscountRule = {
  id: string;
  code: string;
  type: DiscountType;
  value: string;
  minPurchaseAmount: string | null;
  maxUsesTotal: number | null;
  maxUsesPerCustomer: number | null;
  usedCount: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  /** Only these products count (null: every product). */
  productIds: string[] | null;
  /** Only products in these categories count (null: every product). */
  categoryIds: string[] | null;
  /** Eligible items needed in the cart. */
  minQuantity: number | null;
  /** Only members of these customer groups (null: anyone). */
  customerGroupIds: string[] | null;
};

export type DiscountLine = { productId: string; categoryIds: string[]; quantity: number; cents: number };

export type DiscountShopper = { signedIn: boolean; groupIds: string[]; usesByCustomer: number };

export type DiscountRefusal =
  | "inactive"
  | "not_started"
  | "expired"
  | "used_up"
  | "sign_in_required"
  | "customer_limit"
  | "not_eligible"
  | "min_quantity"
  | "min_purchase";

export type DiscountResult =
  | { ok: true; amountCents: number; freeShipping: boolean; eligibleCents: number }
  | { ok: false; reason: DiscountRefusal };

/** Stripe refuses a payment under 0.50, so a discount never takes the total below it. */
export const MIN_CHARGE_CENTS = 50;

const cents = (amount: string) => Math.round(Number(amount) * 100);

export function evaluateDiscount(rule: DiscountRule, lines: DiscountLine[], shopper: DiscountShopper, now = new Date()): DiscountResult {
  if (!rule.isActive) return { ok: false, reason: "inactive" };
  if (rule.startsAt && rule.startsAt > now) return { ok: false, reason: "not_started" };
  if (rule.endsAt && rule.endsAt < now) return { ok: false, reason: "expired" };
  if (rule.maxUsesTotal != null && rule.usedCount >= rule.maxUsesTotal) return { ok: false, reason: "used_up" };
  if (rule.customerGroupIds || rule.maxUsesPerCustomer != null) {
    if (!shopper.signedIn) return { ok: false, reason: "sign_in_required" };
  }
  if (rule.customerGroupIds && !rule.customerGroupIds.some((g) => shopper.groupIds.includes(g))) {
    return { ok: false, reason: "not_eligible" };
  }
  if (rule.maxUsesPerCustomer != null && shopper.usesByCustomer >= rule.maxUsesPerCustomer) {
    return { ok: false, reason: "customer_limit" };
  }

  const subtotal = lines.reduce((sum, l) => sum + l.cents * l.quantity, 0);
  if (rule.minPurchaseAmount != null && subtotal < cents(rule.minPurchaseAmount)) return { ok: false, reason: "min_purchase" };

  const products = rule.productIds ? new Set(rule.productIds) : null;
  const categories = rule.categoryIds ? new Set(rule.categoryIds) : null;
  const eligible = lines.filter((l) => {
    if (!products && !categories) return true;
    return (products?.has(l.productId) ?? false) || (categories ? l.categoryIds.some((c) => categories.has(c)) : false);
  });
  if (!eligible.length) return { ok: false, reason: "not_eligible" };
  const quantity = eligible.reduce((sum, l) => sum + l.quantity, 0);
  if (rule.minQuantity != null && quantity < rule.minQuantity) return { ok: false, reason: "min_quantity" };

  const eligibleCents = eligible.reduce((sum, l) => sum + l.cents * l.quantity, 0);
  if (rule.type === "FREE_SHIPPING") return { ok: true, amountCents: 0, freeShipping: true, eligibleCents };

  const raw = rule.type === "PERCENTAGE" ? Math.round((eligibleCents * Math.min(Number(rule.value), 100)) / 100) : cents(rule.value);
  const amountCents = Math.max(0, Math.min(raw, eligibleCents, subtotal - MIN_CHARGE_CENTS));
  return { ok: true, amountCents, freeShipping: false, eligibleCents };
}

export const normalizeCode = (code: string) => code.trim().toUpperCase();

