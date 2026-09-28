import { AddToCart } from "@/components/store/add-to-cart";
import { StoreHeader } from "@/components/store/store-header";
import { formatMoney } from "@/lib/money";
import { getProduct } from "@/lib/storefront";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = await getProduct(slug);
  if (!item) return {};
  return {
    title: item.metaTitle || `${item.name} — HM Froid`,
    description: item.metaDescription || item.description?.slice(0, 160),
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = await getProduct(slug);
  if (!item) notFound();

  const image = item.images[0]?.url || null;

  return (
    <>
      <StoreHeader />
      <main className="mx-auto grid max-w-7xl gap-10 px-5 py-12 lg:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-3xl border bg-secondary">
          {image ? (
            <Image
              src={image}
              alt={item.images[0]?.alt || item.name}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-contain p-8"
            />
          ) : (
            <div className="grid h-full place-items-center text-muted-foreground">
              Image indisponible
            </div>
          )}
        </div>
        <section className="self-center">
          {item.brand && (
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              {item.brand}
            </p>
          )}
          <h1 className="mt-2 font-display text-5xl uppercase leading-tight">
            {item.name}
          </h1>
          <p className="mt-5 text-2xl font-bold">{formatMoney(item.basePrice)}</p>
          {item.description && (
            <p className="mt-6 whitespace-pre-line leading-7 text-muted-foreground">
              {item.description}
            </p>
          )}
          <div className="mt-8">
            <AddToCart
              product={{ name: item.name, slug: item.slug }}
              variants={item.variants}
              image={image}
            />
          </div>
        </section>
      </main>
    </>
  );
}
