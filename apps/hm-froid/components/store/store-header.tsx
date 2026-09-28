"use client";

import { useCart } from "@/components/store/cart-provider";
import { ShoppingCart, Snowflake } from "lucide-react";
import Link from "next/link";

export function StoreHeader() {
  const { count } = useCart();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <Snowflake className="size-6 text-primary" aria-hidden />
          HM Froid
        </Link>
        <nav className="flex items-center gap-5 text-sm font-medium" aria-label="Navigation boutique">
          <Link href="/shop">Boutique</Link>
          <Link href="/cart" className="flex items-center gap-2">
            <ShoppingCart className="size-5" aria-hidden />
            Panier
            {count > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {count}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
