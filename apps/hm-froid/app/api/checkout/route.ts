import {
  db,
  inventoryItem,
  product,
  productVariant,
  site,
} from "@qubo/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { storefrontOrigin, stripeRequest } from "@/lib/stripe";

export const runtime = "nodejs";

const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(10)
    .refine(
      (items) => new Set(items.map((item) => item.variantId)).size === items.length,
      "Duplicate variants are not allowed",
    ),
});

type StripeCheckoutSession = { id: string; url: string | null };

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Panier invalide." }, { status: 400 });
    }

    const siteSlug = process.env.STOREFRONT_SITE_SLUG?.trim() || "hm-froid";
    const currentSite = await db.query.site.findFirst({
      where: eq(site.slug, siteSlug),
    });
    if (!currentSite) {
      return Response.json({ error: "Boutique indisponible." }, { status: 503 });
    }

    const requested = new Map(
      parsed.data.items.map((item) => [item.variantId, item.quantity]),
    );
    const variants = await db
      .select({
        id: productVariant.id,
        name: productVariant.name,
        productName: product.name,
        price: sql<string>`coalesce(${productVariant.price}, ${product.basePrice})`,
        tracked: inventoryItem.tracked,
        available: sql<number | null>`case
          when ${inventoryItem.tracked} then greatest(${inventoryItem.quantity} - ${inventoryItem.reservedQuantity}, 0)
          else null
        end`,
      })
      .from(productVariant)
      .innerJoin(product, eq(product.id, productVariant.productId))
      .leftJoin(inventoryItem, eq(inventoryItem.variantId, productVariant.id))
      .where(
        and(
          eq(productVariant.siteId, currentSite.id),
          eq(product.isArchived, false),
          inArray(productVariant.id, [...requested.keys()]),
        ),
      );

    if (variants.length !== requested.size) {
      return Response.json(
        { error: "Un ou plusieurs produits ne sont plus disponibles." },
        { status: 409 },
      );
    }

    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("success_url", `${storefrontOrigin(request)}/checkout/success?session_id={CHECKOUT_SESSION_ID}`);
    form.set("cancel_url", `${storefrontOrigin(request)}/checkout/cancel`);
    form.set("billing_address_collection", "required");
    form.set("shipping_address_collection[allowed_countries][0]", "BE");
    form.set("shipping_address_collection[allowed_countries][1]", "FR");
    form.set("shipping_address_collection[allowed_countries][2]", "LU");
    form.set("automatic_tax[enabled]", "true");
    const shippingCents = Number.parseInt(
      process.env.HMF_SHIPPING_RATE_CENTS ?? "0",
      10,
    );
    if (Number.isSafeInteger(shippingCents) && shippingCents >= 0) {
      form.set(
        "shipping_options[0][shipping_rate_data][display_name]",
        process.env.HMF_SHIPPING_LABEL?.trim() || "Livraison professionnelle",
      );
      form.set(
        "shipping_options[0][shipping_rate_data][type]",
        "fixed_amount",
      );
      form.set(
        "shipping_options[0][shipping_rate_data][fixed_amount][amount]",
        String(shippingCents),
      );
      form.set(
        "shipping_options[0][shipping_rate_data][fixed_amount][currency]",
        currentSite.currency.toLowerCase(),
      );
    }
    form.set("metadata[site_id]", currentSite.id);
    form.set(
      "metadata[cart]",
      parsed.data.items
        .map((item) => `${item.variantId.replaceAll("-", "")}:${item.quantity}`)
        .join(","),
    );

    variants.forEach((variant, index) => {
      const quantity = requested.get(variant.id)!;
      if (variant.available !== null && variant.available < quantity) {
        throw new Error(`${variant.productName} n'est plus disponible en quantité demandée.`);
      }
      const cents = Math.round(Number(variant.price) * 100);
      if (!Number.isSafeInteger(cents) || cents < 50) {
        throw new Error(`Prix invalide pour ${variant.productName}.`);
      }
      form.set(`line_items[${index}][quantity]`, String(quantity));
      form.set(`line_items[${index}][price_data][currency]`, currentSite.currency.toLowerCase());
      form.set(`line_items[${index}][price_data][unit_amount]`, String(cents));
      form.set(
        `line_items[${index}][price_data][product_data][name]`,
        variant.name === "Default"
          ? variant.productName
          : `${variant.productName} — ${variant.name}`,
      );
    });

    const session = await stripeRequest<StripeCheckoutSession>("/checkout/sessions", {
      method: "POST",
      body: form,
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return Response.json({ url: session.url });
  } catch (error) {
    console.error("Checkout initiation failed", error);
    return Response.json(
      {
        error:
          error instanceof Error && !error.message.startsWith("Missing required")
            ? error.message
            : "Impossible de démarrer le paiement.",
      },
      { status: 500 },
    );
  }
}
