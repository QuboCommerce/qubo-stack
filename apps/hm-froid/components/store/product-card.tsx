import type { StorefrontProduct } from "@/lib/storefront";
import { formatMoney } from "@/lib/money";
import Image from "next/image";
import Link from "next/link";

export function ProductCard({ product }: { product: StorefrontProduct }) {
  return (
    <article className="overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <Link href={`/shop/${product.slug}`}>
        <div className="relative aspect-square bg-secondary">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-contain p-5"
            />
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              Image indisponible
            </div>
          )}
        </div>
        <div className="space-y-2 p-5">
          {product.brand && (
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {product.brand}
            </p>
          )}
          <h2 className="line-clamp-2 font-semibold">{product.name}</h2>
          <p className="text-lg font-bold text-primary">{formatMoney(product.price)}</p>
        </div>
      </Link>
    </article>
  );
}
