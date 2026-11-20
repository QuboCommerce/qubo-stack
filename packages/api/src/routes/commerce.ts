import { Elysia, t } from "elysia";
import { db } from "@qubo/db/client";
import {
  discount,
  discountUsage,
  inventoryItem,
  order as orderTable,
  orderItem,
  orderStatusHistory,
  payment,
  product,
  productImage,
  productVariant,
  site as siteTable,
  user,
} from "@qubo/db/schema";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { tenancy } from "../plugins/tenancy";
import { keyOf, resolvePrices } from "../lib/pricing";
import { StripeConfigError, stripeRequest, verifyStripeSignature } from "../lib/stripe";
import { sendOrderConfirmation } from "../lib/order-email";
import { allowedSiteOrigin } from "../lib/origins";
import { categoriesOf, evaluateDiscount, loadDiscount, shopperFor, type DiscountRule } from "../lib/discounts";

const MAX_LINES = 10;
const MAX_QTY = 20;

/** Stripe metadata values cap at 500 chars: `<uuid w/o dashes>:<qty>:<unit cents>` × 10 fits. */
const encodeCart = (lines: { variantId: string; quantity: number; cents: number }[]) =>
  lines.map((l) => `${l.variantId.replaceAll("-", "")}:${l.quantity}:${l.cents}`).join(",");

function decodeCart(value: string) {
  const lines = value.split(",").map((entry) => {
    const [id, qty, cents] = entry.split(":");
    const variantId = id && /^[a-f0-9]{32}$/i.test(id)
      ? `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`
      : null;
    const quantity = Number(qty);
    const unit = Number(cents);
    if (!variantId || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY || !Number.isSafeInteger(unit) || unit < 0) {
      throw new Error("Invalid cart metadata");
    }
    return { variantId, quantity, cents: unit };
  });
  if (!lines.length || lines.length > MAX_LINES) throw new Error("Invalid cart size");
  return lines;
}

const decimal = (cents: number) => (cents / 100).toFixed(2);

/** Short uppercase prefix for order numbers, from the site slug (`hm-froid` → `HMF`). */
function orderPrefix(slug: string) {
  const parts = slug.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  const initials = parts.length > 1 ? parts.map((p) => p[0]).join("") + (parts.at(-1)?.[1] ?? "") : parts[0] ?? "ORD";
  return initials.slice(0, 4);
}

type CartItem = { variantId: string; quantity: number };
type PricedLine = { variantId: string; productId: string; quantity: number; cents: number; name: string };

/** Re-prices a cart from the database: availability, stock and the shopper's price list. */
async function priceCart(
  siteId: string,
  userId: string | null,
  items: CartItem[],
): Promise<{ lines: PricedLine[] } | { error: string; status: 400 | 409; variantId?: string }> {
  const ids = items.map((i) => i.variantId);
  if (new Set(ids).size !== ids.length) return { error: "duplicate_variants", status: 400 };
  const variants = await db
    .select({
      id: productVariant.id,
      name: productVariant.name,
      productId: product.id,
      productName: product.name,
      basePrice: product.basePrice,
      variantPrice: productVariant.price,
      available: sql<number | null>`case
        when ${inventoryItem.tracked} then greatest(${inventoryItem.quantity} - ${inventoryItem.reservedQuantity}, 0)
        else null end`,
    })
    .from(productVariant)
    .innerJoin(product, eq(product.id, productVariant.productId))
    .leftJoin(inventoryItem, eq(inventoryItem.variantId, productVariant.id))
    .where(and(eq(productVariant.siteId, siteId), eq(product.isArchived, false), inArray(productVariant.id, ids)));
  if (variants.length !== ids.length) return { error: "unavailable", status: 409 };

  const prices = await resolvePrices(
    siteId,
    userId,
    variants.map((v) => ({ productId: v.productId, variantId: v.id, basePrice: v.basePrice, variantPrice: v.variantPrice })),
  );
  const quantities = new Map(items.map((i) => [i.variantId, i.quantity]));
  const lines: PricedLine[] = [];
  for (const v of variants) {
    const quantity = quantities.get(v.id)!;
    if (v.available !== null && v.available < quantity) return { error: "insufficient_stock", status: 409, variantId: v.id };
    const cents = Math.round(Number(prices.get(keyOf({ productId: v.productId, variantId: v.id }))!.amount) * 100);
    if (!Number.isSafeInteger(cents) || cents < 50) return { error: "invalid_price", status: 409, variantId: v.id };
    lines.push({
      variantId: v.id,
      productId: v.productId,
      quantity,
      cents,
      name: !v.name || v.name === "Default" ? v.productName : `${v.productName} — ${v.name}`,
    });
  }
  return { lines };
}

async function checkCode(siteId: string, userId: string | null, code: string, lines: PricedLine[]) {
  const rule = await loadDiscount(siteId, code);
  if (!rule) return { ok: false as const, reason: "unknown" as const };
  const [categories, shopper] = await Promise.all([categoriesOf([...new Set(lines.map((l) => l.productId))]), shopperFor(rule.id, userId)]);
  const result = evaluateDiscount(
    rule,
    lines.map((l) => ({ productId: l.productId, categoryIds: categories.get(l.productId) ?? [], quantity: l.quantity, cents: l.cents })),
    shopper,
  );
  return result.ok ? { ...result, rule } : result;
}

const cartItems = t.Array(t.Object({ variantId: t.String({ format: "uuid" }), quantity: t.Integer({ minimum: 1, maximum: MAX_QTY }) }), {
  minItems: 1,
  maxItems: MAX_LINES,
});

type CheckoutSession = { id: string; url: string | null };

export const commerce = new Elysia()
  .use(tenancy)
  .post(
    "/checkout",
    async ({ site, actor, body, status }) => {
      if (!site) return status(400, { error: "site_not_resolved" });
      if (!site.capabilities.includes("commerce")) return status(404, { error: "not_found" });
      const origin = await allowedSiteOrigin(site, body.returnOrigin);
      if (!origin) return status(400, { error: "invalid_return_origin" });
      const priced = await priceCart(site.id, actor?.id ?? null, body.items);
      if ("error" in priced) return status(priced.status, { error: priced.error, variantId: priced.variantId });
      const { lines } = priced;

      let applied: { rule: DiscountRule; amountCents: number; freeShipping: boolean } | null = null;
      if (body.code?.trim()) {
        const checked = await checkCode(site.id, actor?.id ?? null, body.code, lines);
        if (!checked.ok) return status(409, { error: "discount_refused", reason: checked.reason });
        applied = checked;
      }

      const currency = site.currency.toLowerCase();
      const form = new URLSearchParams();
      form.set("mode", "payment");
      form.set("locale", site.locale.split("-")[0] ?? "auto");
      form.set("success_url", `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`);
      form.set("cancel_url", `${origin}/cart`);
      form.set("billing_address_collection", "required");
      const countries = (process.env.CHECKOUT_COUNTRIES ?? "BE,FR,LU,NL").split(",").map((c) => c.trim()).filter(Boolean);
      countries.forEach((c, i) => form.set(`shipping_address_collection[allowed_countries][${i}]`, c));
      if (process.env.CHECKOUT_AUTOMATIC_TAX !== "0") form.set("automatic_tax[enabled]", "true");
      const shippingCents = Number.parseInt(process.env.CHECKOUT_SHIPPING_CENTS ?? "", 10);
      if (Number.isSafeInteger(shippingCents) && shippingCents >= 0) {
        const free = applied?.freeShipping ?? false;
        form.set("shipping_options[0][shipping_rate_data][display_name]", process.env.CHECKOUT_SHIPPING_LABEL?.trim() || "Delivery");
        form.set("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
        form.set("shipping_options[0][shipping_rate_data][fixed_amount][amount]", String(free ? 0 : shippingCents));
        form.set("shipping_options[0][shipping_rate_data][fixed_amount][currency]", currency);
      }
      form.set("metadata[site_id]", site.id);
      if (actor) {
        // Links the order to the signed-in customer (see /account) and prefills their email.
        form.set("client_reference_id", actor.id);
        form.set("customer_email", actor.email);
      }
      form.set("metadata[cart]", encodeCart(lines));
      lines.forEach((l, i) => {
        form.set(`line_items[${i}][quantity]`, String(l.quantity));
        form.set(`line_items[${i}][price_data][currency]`, currency);
        form.set(`line_items[${i}][price_data][unit_amount]`, String(l.cents));
        form.set(`line_items[${i}][price_data][product_data][name]`, l.name);
      });

      try {
        if (applied) {
          form.set("metadata[discount_id]", applied.rule.id);
          if (applied.amountCents > 0) {
            // A one-off coupon for exactly this saving: Stripe then shows it and reports it in total_details.
            const coupon = new URLSearchParams({
              amount_off: String(applied.amountCents),
              currency,
              duration: "once",
              max_redemptions: "1",
              name: applied.rule.code.slice(0, 40),
            });
            const { id } = await stripeRequest<{ id: string }>("/coupons", { method: "POST", body: coupon });
            form.set("discounts[0][coupon]", id);
          }
        }
        const session = await stripeRequest<CheckoutSession>("/checkout/sessions", { method: "POST", body: form });
        if (!session.url) throw new Error("Stripe returned no checkout URL");
        return { url: session.url };
      } catch (error) {
        if (error instanceof StripeConfigError) return status(503, { error: "payments_not_configured" });
        console.error("[checkout]", error);
        return status(502, { error: "payment_provider_error" });
      }
    },
    {
      body: t.Object({ items: cartItems, returnOrigin: t.String({ maxLength: 300 }), code: t.Optional(t.String({ maxLength: 60 })) }),
      detail: { summary: "Creates a Stripe Checkout session for the resolved site's cart" },
    },
  )
  .post(
    "/discounts/check",
    async ({ site, actor, body, status }) => {
      if (!site) return status(400, { error: "site_not_resolved" });
      if (!site.capabilities.includes("commerce")) return status(404, { error: "not_found" });
      const priced = await priceCart(site.id, actor?.id ?? null, body.items);
      if ("error" in priced) return status(priced.status, { error: priced.error, variantId: priced.variantId });
      const checked = await checkCode(site.id, actor?.id ?? null, body.code, priced.lines);
      if (!checked.ok) return { ok: false as const, reason: checked.reason };
      const subtotal = priced.lines.reduce((sum, l) => sum + l.cents * l.quantity, 0);
      return {
        ok: true as const,
        code: checked.rule.code,
        type: checked.rule.type,
        amount: decimal(checked.amountCents),
        freeShipping: checked.freeShipping,
        subtotal: decimal(subtotal),
      };
    },
    {
      body: t.Object({ items: cartItems, code: t.String({ minLength: 1, maxLength: 60 }) }),
      detail: { summary: "Checks a discount code against a cart and returns the saving" },
    },
  );

/** Provider-facing webhooks stay unversioned: their URLs live in third-party dashboards. */
export const webhooks = new Elysia()
  .post(
    "/webhooks/stripe",
    async ({ request, status }) => {
      const raw = await request.text();
      try {
        if (!verifyStripeSignature(raw, request.headers.get("stripe-signature"))) return status(400, { error: "invalid_signature" });
      } catch (error) {
        if (error instanceof StripeConfigError) return status(503, { error: "payments_not_configured" });
        throw error;
      }
      const event = JSON.parse(raw) as { id: string; type: string; data: { object: StripeSession } };
      if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
        return { received: true };
      }
      const session = event.data.object;
      if (session.payment_status !== "paid") return { received: true };
      try {
        await recordOrder(event.id, session);
      } catch (error) {
        console.error("[stripe webhook]", error);
        return status(400, { error: "webhook_failed" });
      }
      return { received: true };
    },
    { parse: "none", detail: { summary: "Stripe webhook: records paid checkouts as orders" } },
  );

type StripeAddress = Record<string, unknown> | null;
type StripeSession = {
  id: string;
  payment_status: string;
  amount_subtotal: number;
  amount_total: number;
  currency: string;
  total_details?: { amount_discount?: number; amount_shipping?: number | null; amount_tax?: number } | null;
  customer_details?: { email: string | null; name: string | null; address?: StripeAddress } | null;
  shipping_details?: { name?: string | null; address?: StripeAddress } | null;
  collected_information?: { shipping_details?: { name?: string | null; address?: StripeAddress } | null } | null;
  payment_method_types?: string[];
  client_reference_id?: string | null;
  metadata?: { site_id?: string; store_id?: string; cart?: string; discount_id?: string };
};

async function recordOrder(eventId: string, session: StripeSession) {
  const siteId = session.metadata?.site_id ?? session.metadata?.store_id;
  if (!siteId || !session.metadata?.cart || !session.id.startsWith("cs_")) throw new Error("Missing checkout metadata");
  const cart = decodeCart(session.metadata.cart);
  const subtotal = cart.reduce((sum, l) => sum + l.cents * l.quantity, 0);
  if (subtotal !== session.amount_subtotal) throw new Error("Stripe subtotal does not match cart metadata");

  const [owner] = await db
    .select({ slug: siteTable.slug, name: siteTable.name, locale: siteTable.locale })
    .from(siteTable)
    .where(eq(siteTable.id, siteId))
    .limit(1);
  if (!owner) throw new Error("Unknown site");
  const customerId = session.client_reference_id
    ? ((await db.select({ id: user.id }).from(user).where(eq(user.id, session.client_reference_id)).limit(1))[0]?.id ?? null)
    : null;

  const variants = await db
    .select({
      id: productVariant.id,
      name: productVariant.name,
      sku: productVariant.sku,
      productName: product.name,
      image: sql<string | null>`(select ${productImage.url} from ${productImage}
        where ${productImage.productId} = ${product.id} order by ${productImage.position} asc limit 1)`,
    })
    .from(productVariant)
    .innerJoin(product, eq(product.id, productVariant.productId))
    .where(and(eq(productVariant.siteId, siteId), inArray(productVariant.id, cart.map((l) => l.variantId))))
    .orderBy(asc(productVariant.position));
  if (variants.length !== cart.length) throw new Error("Cart products no longer exist");
  const lineOf = new Map(cart.map((l) => [l.variantId, l]));

  const shipping = session.collected_information?.shipping_details ?? session.shipping_details;
  const customerName = session.customer_details?.name ?? shipping?.name ?? null;
  const email = session.customer_details?.email ?? null;
  const currency = session.currency.toUpperCase();
  const orderNumber = `${orderPrefix(owner.slug)}-${session.id.slice(-14).toUpperCase()}`;
  let created = false;

  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`stripe:${session.id}`}))`);
    const existing = await tx.query.payment.findFirst({
      where: and(eq(payment.processor, "STRIPE"), eq(payment.processorId, session.id)),
    });
    if (existing) return;

    const [row] = await tx
      .insert(orderTable)
      .values({
        siteId,
        customerId,
        customerEmail: email,
        customerName,
        orderNumber,
        status: "CONFIRMED",
        subtotal: decimal(session.amount_subtotal),
        taxTotal: decimal(session.total_details?.amount_tax ?? 0),
        shippingTotal: decimal(session.total_details?.amount_shipping ?? 0),
        discountTotal: decimal(session.total_details?.amount_discount ?? 0),
        total: decimal(session.amount_total),
        currency,
        shippingAddress: shipping?.address ?? session.customer_details?.address ?? null,
        billingAddress: session.customer_details?.address ?? null,
        notes: `Stripe event ${eventId}`,
      })
      .returning({ id: orderTable.id });
    if (!row) throw new Error("Order insert failed");

    await tx.insert(orderItem).values(
      variants.map((v) => {
        const line = lineOf.get(v.id)!;
        return {
          orderId: row.id,
          variantId: v.id,
          quantity: line.quantity,
          unitPrice: decimal(line.cents),
          totalPrice: decimal(line.cents * line.quantity),
          productName: v.productName,
          variantName: v.name,
          sku: v.sku,
          imageUrl: v.image,
        };
      }),
    );
    await tx.insert(orderStatusHistory).values({
      orderId: row.id,
      fromStatus: "PENDING",
      toStatus: "CONFIRMED",
      note: `Stripe checkout ${session.id}`,
    });

    // Paid is paid: stock goes to zero rather than failing the order (and Stripe retrying forever).
    for (const v of variants) {
      await tx
        .update(inventoryItem)
        .set({ quantity: sql`greatest(${inventoryItem.quantity} - ${lineOf.get(v.id)!.quantity}, 0)` })
        .where(and(eq(inventoryItem.variantId, v.id), eq(inventoryItem.tracked, true)));
    }

    await tx.insert(payment).values({
      orderId: row.id,
      processor: "STRIPE",
      processorId: session.id,
      method: session.payment_method_types?.includes("bancontact") ? "BANCONTACT" : "CARD",
      status: "COMPLETED",
      amount: decimal(session.amount_total),
      currency,
    });
    const discountId = session.metadata?.discount_id;
    if (discountId && /^[0-9a-f-]{36}$/i.test(discountId)) {
      const [used] = await tx
        .insert(discountUsage)
        .values({ discountId, orderId: row.id, customerId })
        .onConflictDoNothing()
        .returning({ id: discountUsage.id });
      if (used) await tx.update(discount).set({ usedCount: sql`${discount.usedCount} + 1` }).where(eq(discount.id, discountId));
    }
    created = true;
  });

  if (created) {
    await sendOrderConfirmation({
      siteName: owner.name,
      locale: owner.locale,
      email,
      customerName,
      orderNumber,
      total: decimal(session.amount_total),
      currency,
    }).catch((error) => console.error("[order email]", error));
  }
}
