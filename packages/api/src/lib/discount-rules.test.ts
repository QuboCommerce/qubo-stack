import { describe, expect, test } from "bun:test";
import { evaluateDiscount, type DiscountLine, type DiscountRule, type DiscountShopper } from "./discount-rules";

const rule = (over: Partial<DiscountRule> = {}): DiscountRule => ({
  id: "d1",
  code: "PROMO10",
  type: "PERCENTAGE",
  value: "10",
  minPurchaseAmount: null,
  maxUsesTotal: null,
  maxUsesPerCustomer: null,
  usedCount: 0,
  startsAt: null,
  endsAt: null,
  isActive: true,
  productIds: null,
  categoryIds: null,
  minQuantity: null,
  customerGroupIds: null,
  ...over,
});
const guest: DiscountShopper = { signedIn: false, groupIds: [], usesByCustomer: 0 };
const fridge: DiscountLine = { productId: "p-fridge", categoryIds: ["c-froid"], quantity: 1, cents: 100_000 };
const pan: DiscountLine = { productId: "p-pan", categoryIds: ["c-cuisson"], quantity: 2, cents: 2_500 };
const now = new Date("2026-11-20T12:00:00Z");

describe("evaluateDiscount", () => {
  test("percentage applies to the whole cart", () => {
    expect(evaluateDiscount(rule(), [fridge, pan], guest, now)).toEqual({ ok: true, amountCents: 10_500, freeShipping: false, eligibleCents: 105_000 });
  });

  test("category scope only discounts the lines in that category", () => {
    const r = evaluateDiscount(rule({ categoryIds: ["c-cuisson"] }), [fridge, pan], guest, now);
    expect(r).toMatchObject({ ok: true, amountCents: 500, eligibleCents: 5_000 });
  });

  test("a fixed amount is capped by the eligible lines and keeps the Stripe minimum", () => {
    expect(evaluateDiscount(rule({ type: "FIXED_AMOUNT", value: "100", productIds: ["p-pan"] }), [fridge, pan], guest, now)).toMatchObject({ amountCents: 5_000 });
    expect(evaluateDiscount(rule({ type: "FIXED_AMOUNT", value: "100" }), [pan], guest, now)).toMatchObject({ amountCents: 4_950 });
  });

  test("free shipping saves nothing on the lines", () => {
    expect(evaluateDiscount(rule({ type: "FREE_SHIPPING", value: "0" }), [pan], guest, now)).toMatchObject({ ok: true, amountCents: 0, freeShipping: true });
  });

  test("refuses outside its window, when used up, or below the minimum", () => {
    const refuse = (over: Partial<DiscountRule>, lines = [pan]) => {
      const r = evaluateDiscount(rule(over), lines, guest, now);
      return r.ok ? "ok" : r.reason;
    };
    expect(refuse({ isActive: false })).toBe("inactive");
    expect(refuse({ startsAt: new Date("2026-12-01") })).toBe("not_started");
    expect(refuse({ endsAt: new Date("2026-11-01") })).toBe("expired");
    expect(refuse({ maxUsesTotal: 5, usedCount: 5 })).toBe("used_up");
    expect(refuse({ minPurchaseAmount: "100.00" })).toBe("min_purchase");
    expect(refuse({ productIds: ["p-other"] })).toBe("not_eligible");
    expect(refuse({ minQuantity: 3 })).toBe("min_quantity");
  });

  test("group and per-customer limits need a signed-in shopper", () => {
    const member: DiscountShopper = { signedIn: true, groupIds: ["g-pro"], usesByCustomer: 1 };
    expect(evaluateDiscount(rule({ customerGroupIds: ["g-pro"] }), [pan], guest, now)).toEqual({ ok: false, reason: "sign_in_required" });
    expect(evaluateDiscount(rule({ customerGroupIds: ["g-pro"] }), [pan], member, now).ok).toBe(true);
    expect(evaluateDiscount(rule({ customerGroupIds: ["g-other"] }), [pan], member, now)).toEqual({ ok: false, reason: "not_eligible" });
    expect(evaluateDiscount(rule({ maxUsesPerCustomer: 1 }), [pan], member, now)).toEqual({ ok: false, reason: "customer_limit" });
  });
});
