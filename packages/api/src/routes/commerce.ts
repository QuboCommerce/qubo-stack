import { Elysia, t } from "elysia";
import { db } from "@qubo/db/client";
import {
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

type CheckoutSession = { id: string; url: string | null };

export const commerce = new Elysia()
  .use(tenancy)
  .post(
    "/checkout",
    async ({ site, actor, body, status }) => {
      if (!site) return status(400, { error: "site_not_resolved" });
      if (!site.capabilities.includes("commerce")) return status(404, { error: "not_found" });
      const ids = body.items.map((i) => i.variantId);
      if (new Set(ids).size !== ids.length) return status(400, { error: "duplicate_variants" });
      const origin = await allowedSiteOrigin(site, body.returnOrigin);
      if (!origin) return status(400, { error: "invalid_return_origin" });

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
        .where(and(eq(productVariant.siteId, site.id), eq(product.isArchived, false), inArray(productVariant.id, ids)));
      if (variants.length !== ids.length) return status(409, { error: "unavailable" });

      const prices = await resolvePrices(
        site.id,
        actor?.id ?? null,
        variants.map((v) => ({ productId: v.productId, variantId: v.id, basePrice: v.basePrice, variantPrice: v.variantPrice })),
      );
      const quantities = new Map(body.items.map((i) => [i.variantId, i.quantity]));
      const lines = [];
      for (const v of variants) {
        const quantity = quantities.get(v.id)!;
        if (v.available !== null && v.available < quantity) return status(409, { error: "insufficient_stock", variantId: v.id });
        const cents = Math.round(Number(prices.get(keyOf({ productId: v.productId, variantId: v.id }))!.amount) * 100);
        if (!Number.isSafeInteger(cents) || cents < 50) return status(409, { error: "invalid_price", variantId: v.id });
        lines.push({ variantId: v.id, quantity, cents, name: !v.name || v.name === "Default" ? v.productName : `${v.productName} — ${v.name}` });
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
        form.set("shipping_options[0][shipping_rate_data][display_name]", process.env.CHECKOUT_SHIPPING_LABEL?.trim() || "Delivery");
        form.set("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
        form.set("shipping_options[0][shipping_rate_data][fixed_amount][amount]", String(shippingCents));
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
      body: t.Object({
        items: t.Array(t.Object({ variantId: t.String({ format: "uuid" }), quantity: t.Integer({ minimum: 1, maximum: MAX_QTY }) }), {
          minItems: 1,
          maxItems: MAX_LINES,
        }),
        returnOrigin: t.String({ maxLength: 300 }),
      }),
      detail: { summary: "Creates a Stripe Checkout session for the resolved site's cart" },
    },
  )
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
  metadata?: { site_id?: string; store_id?: string; cart?: string };
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
