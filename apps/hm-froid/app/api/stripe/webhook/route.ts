import {
  db,
  inventoryItem,
  order as orderTable,
  orderItem,
  orderStatusHistory,
  payment,
  product,
  productImage,
  productVariant,
} from "@peltier/db";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { sendOrderConfirmation } from "@/lib/order-email";
import { verifyStripeSignature } from "@/lib/stripe";

export const runtime = "nodejs";

const sessionSchema = z.object({
  id: z.string().startsWith("cs_"),
  object: z.literal("checkout.session"),
  payment_status: z.literal("paid"),
  payment_intent: z.union([z.string(), z.object({ id: z.string() })]).nullable(),
  amount_subtotal: z.number().int().nonnegative(),
  amount_total: z.number().int().nonnegative(),
  total_details: z
    .object({
      amount_discount: z.number().int().nonnegative().default(0),
      amount_shipping: z.number().int().nonnegative().nullable().default(0),
      amount_tax: z.number().int().nonnegative().default(0),
    })
    .default({ amount_discount: 0, amount_shipping: 0, amount_tax: 0 }),
  currency: z.string().min(3).max(3),
  customer_details: z
    .object({
      email: z.string().email().nullable(),
      name: z.string().nullable(),
      address: z.record(z.string(), z.unknown()).nullable().optional(),
    })
    .nullable()
    .optional(),
  shipping_details: z
    .object({
      name: z.string().nullable().optional(),
      address: z.record(z.string(), z.unknown()).nullable().optional(),
    })
    .nullable()
    .optional(),
  payment_method_types: z.array(z.string()).optional(),
  metadata: z.object({
    store_id: z.string().uuid(),
    cart: z.string().min(1).max(500),
  }),
});

const eventSchema = z.object({
  id: z.string().startsWith("evt_"),
  type: z.string(),
  data: z.object({ object: z.unknown() }),
});

function restoreUuid(value: string) {
  if (!/^[a-f0-9]{32}$/i.test(value)) return null;
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function parseCart(value: string) {
  const items = value.split(",").map((entry) => {
    const [compactId, rawQuantity] = entry.split(":");
    const variantId = compactId ? restoreUuid(compactId) : null;
    const quantity = Number(rawQuantity);
    if (!variantId || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw new Error("Invalid cart metadata");
    }
    return { variantId, quantity };
  });
  if (!items.length || items.length > 10) throw new Error("Invalid cart size");
  if (new Set(items.map((item) => item.variantId)).size !== items.length) {
    throw new Error("Duplicate cart variants");
  }
  return items;
}

function decimal(cents: number) {
  return (cents / 100).toFixed(2);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    if (!verifyStripeSignature(rawBody, request.headers.get("stripe-signature"))) {
      return Response.json({ error: "Invalid signature" }, { status: 400 });
    }
    const event = eventSchema.parse(JSON.parse(rawBody));
    if (
      event.type !== "checkout.session.completed" &&
      event.type !== "checkout.session.async_payment_succeeded"
    ) {
      return Response.json({ received: true });
    }
    const session = sessionSchema.parse(event.data.object);
    const cart = parseCart(session.metadata.cart);
    const variantIds = cart.map((item) => item.variantId);
    const variants = await db
      .select({
        id: productVariant.id,
        name: productVariant.name,
        sku: productVariant.sku,
        productName: product.name,
        price: sql<string>`coalesce(${productVariant.price}, ${product.basePrice})`,
        image: sql<string | null>`(
          select ${productImage.url} from ${productImage}
          where ${productImage.productId} = ${product.id}
          order by ${productImage.position} asc limit 1
        )`,
      })
      .from(productVariant)
      .innerJoin(product, eq(product.id, productVariant.productId))
      .where(
        and(
          eq(productVariant.storeId, session.metadata.store_id),
          inArray(productVariant.id, variantIds),
        ),
      )
      .orderBy(asc(productVariant.position));

    if (variants.length !== cart.length) throw new Error("Cart products no longer exist");
    const quantities = new Map(cart.map((item) => [item.variantId, item.quantity]));
    const calculatedSubtotal = variants.reduce(
      (sum, variant) => sum + Math.round(Number(variant.price) * 100) * quantities.get(variant.id)!,
      0,
    );
    if (calculatedSubtotal !== session.amount_subtotal) {
      throw new Error("Stripe subtotal does not match catalog");
    }

    let confirmation:
      | { email: string | null; customerName: string | null; orderNumber: string }
      | undefined;
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`stripe:${session.id}`}))`,
      );
      const existing = await tx.query.payment.findFirst({
        where: and(
          eq(payment.processor, "STRIPE"),
          eq(payment.processorId, session.id),
        ),
      });
      if (existing) return;

      const orderNumber = `HMF-${session.id.slice(-14).toUpperCase()}`;
      const [createdOrder] = await tx
        .insert(orderTable)
        .values({
          storeId: session.metadata.store_id,
          customerEmail: session.customer_details?.email ?? null,
          customerName:
            session.customer_details?.name ??
            session.shipping_details?.name ??
            null,
          orderNumber,
          status: "CONFIRMED",
          subtotal: decimal(session.amount_subtotal),
          taxTotal: decimal(session.total_details.amount_tax),
          shippingTotal: decimal(session.total_details.amount_shipping || 0),
          discountTotal: decimal(session.total_details.amount_discount),
          total: decimal(session.amount_total),
          currency: session.currency.toUpperCase(),
          shippingAddress:
            session.shipping_details?.address ??
            session.customer_details?.address ??
            null,
          billingAddress: session.customer_details?.address ?? null,
          notes: `Stripe event ${event.id}`,
        })
        .returning({ id: orderTable.id });
      if (!createdOrder) throw new Error("Order insert failed");
      confirmation = {
        email: session.customer_details?.email ?? null,
        customerName:
          session.customer_details?.name ??
          session.shipping_details?.name ??
          null,
        orderNumber,
      };

      await tx.insert(orderItem).values(
        variants.map((variant) => {
          const quantity = quantities.get(variant.id)!;
          return {
            orderId: createdOrder.id,
            variantId: variant.id,
            quantity,
            unitPrice: variant.price,
            totalPrice: (Number(variant.price) * quantity).toFixed(2),
            productName: variant.productName,
            variantName: variant.name,
            sku: variant.sku,
            imageUrl: variant.image,
          };
        }),
      );
      await tx.insert(orderStatusHistory).values({
        orderId: createdOrder.id,
        fromStatus: "PENDING",
        toStatus: "CONFIRMED",
        note: `Stripe checkout ${session.id}`,
      });

      for (const variant of variants) {
        const quantity = quantities.get(variant.id)!;
        const [updated] = await tx
          .update(inventoryItem)
          .set({
            quantity: sql`${inventoryItem.quantity} - ${quantity}`,
          })
          .where(
            and(
              eq(inventoryItem.variantId, variant.id),
              eq(inventoryItem.tracked, true),
              sql`${inventoryItem.quantity} - ${inventoryItem.reservedQuantity} >= ${quantity}`,
            ),
          )
          .returning({ id: inventoryItem.id });
        const inventory = await tx.query.inventoryItem.findFirst({
          where: eq(inventoryItem.variantId, variant.id),
        });
        if (inventory?.tracked && !updated) {
          throw new Error(`Insufficient stock for variant ${variant.id}`);
        }
      }

      const isBancontact =
        session.payment_method_types?.includes("bancontact") ?? false;
      await tx.insert(payment).values({
        orderId: createdOrder.id,
        processor: "STRIPE",
        processorId: session.id,
        method: isBancontact ? "BANCONTACT" : "CARD",
        status: "COMPLETED",
        amount: decimal(session.amount_total),
        currency: session.currency.toUpperCase(),
      });
    });

    if (confirmation) {
      try {
        await sendOrderConfirmation({
          ...confirmation,
          total: decimal(session.amount_total),
          currency: session.currency.toUpperCase(),
        });
      } catch (error) {
        // Payment webhooks must not be retried solely because email is down.
        console.error("Order confirmation email failed", error);
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook failed", error);
    return Response.json({ error: "Webhook processing failed" }, { status: 400 });
  }
}
