"use client";

import { useCart } from "@/components/store/cart-provider";
import type { StorefrontVariant } from "@/lib/storefront";
import { formatMoney } from "@/lib/money";
import { useState } from "react";
import { toast } from "sonner";

export function AddToCart({
  product,
  variants,
  image,
}: {
  product: { name: string; slug: string };
  variants: StorefrontVariant[];
  image: string | null;
}) {
  const availableVariants = variants.filter(
    (variant) => variant.available === null || variant.available > 0,
  );
  const [variantId, setVariantId] = useState(availableVariants[0]?.id || "");
  const { addItem } = useCart();
  const selected = variants.find((variant) => variant.id === variantId);

  return (
    <div className="space-y-4">
      {variants.length > 1 && (
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Option</span>
          <select
            value={variantId}
            onChange={(event) => setVariantId(event.target.value)}
            className="w-full rounded-xl border bg-card px-4 py-3"
          >
            {variants.map((variant) => (
              <option
                key={variant.id}
                value={variant.id}
                disabled={variant.available === 0}
              >
                {variant.name} — {formatMoney(variant.price)}
                {variant.available === 0 ? " (épuisé)" : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        type="button"
        disabled={!selected || selected.available === 0}
        onClick={() => {
          if (!selected) return;
          addItem({
            variantId: selected.id,
            productName: product.name,
            productSlug: product.slug,
            variantName: selected.name,
            unitPrice: selected.price,
            quantity: 1,
            image,
          });
          toast.success("Produit ajouté au panier");
        }}
        className="w-full rounded-xl bg-primary px-6 py-4 font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        {selected ? `Ajouter — ${formatMoney(selected.price)}` : "Indisponible"}
      </button>
    </div>
  );
}
