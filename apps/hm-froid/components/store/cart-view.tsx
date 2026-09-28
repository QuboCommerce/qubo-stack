"use client";

import { useCart } from "@/components/store/cart-provider";
import { formatMoney } from "@/lib/money";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

export function CartView() {
  const { items, setQuantity, removeItem } = useCart();
  const [loading, setLoading] = useState(false);
  const total = items.reduce(
    (sum, item) => sum + Number(item.unitPrice) * item.quantity,
    0,
  );

  async function checkout() {
    setLoading(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: items.map(({ variantId, quantity }) => ({ variantId, quantity })),
        }),
      });
      const payload: unknown = await response.json();
      if (
        !response.ok ||
        !payload ||
        typeof payload !== "object" ||
        !("url" in payload) ||
        typeof payload.url !== "string"
      ) {
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String(payload.error)
            : "Impossible de démarrer le paiement.";
        throw new Error(message);
      }
      window.location.assign(payload.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Une erreur est survenue.");
      setLoading(false);
    }
  }

  if (!items.length) {
    return (
      <div className="mt-8 rounded-2xl border bg-card p-10 text-center">
        <p className="text-muted-foreground">Votre panier est vide.</p>
        <Link
          href="/shop"
          className="mt-5 inline-block rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground"
        >
          Voir les produits
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="divide-y rounded-2xl border bg-card">
        {items.map((item) => (
          <div key={item.variantId} className="flex gap-4 p-5">
            <div className="min-w-0 flex-1">
              <Link href={`/shop/${item.productSlug}`} className="font-semibold">
                {item.productName}
              </Link>
              <p className="text-sm text-muted-foreground">{item.variantName}</p>
              <p className="mt-2 font-semibold">{formatMoney(item.unitPrice)}</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={20}
                value={item.quantity}
                aria-label={`Quantité de ${item.productName}`}
                onChange={(event) =>
                  setQuantity(item.variantId, Number(event.target.value))
                }
                className="w-20 rounded-lg border bg-background px-3 py-2"
              />
              <button
                type="button"
                onClick={() => removeItem(item.variantId)}
                className="text-sm text-destructive"
              >
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col items-end gap-4">
        <p className="text-xl">
          Total <strong>{formatMoney(total)}</strong>
        </p>
        <p className="text-sm text-muted-foreground">
          Taxes et livraison calculées au paiement.
        </p>
        <button
          type="button"
          disabled={loading}
          onClick={checkout}
          className="rounded-xl bg-primary px-8 py-4 font-bold text-primary-foreground disabled:opacity-50"
        >
          {loading ? "Redirection…" : "Passer au paiement sécurisé"}
        </button>
      </div>
    </div>
  );
}
