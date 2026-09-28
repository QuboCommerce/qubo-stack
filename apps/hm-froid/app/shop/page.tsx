import { ProductCard } from "@/components/store/product-card";
import { StoreHeader } from "@/components/store/store-header";
import { getCategories, getProducts } from "@/lib/storefront";
import Link from "next/link";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string | string[];
  category?: string | string[];
}>;

function single(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim().slice(0, 100) : "";
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = single(params.q);
  const category = single(params.category);
  const [products, categories] = await Promise.all([
    getProducts({ query, categorySlug: category }),
    getCategories(),
  ]);

  return (
    <>
      <StoreHeader />
      <main className="mx-auto max-w-7xl px-5 py-12">
        <div className="mb-10 max-w-3xl">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-primary">
            Équipement professionnel
          </p>
          <h1 className="font-display text-5xl uppercase">La boutique du froid</h1>
          <p className="mt-3 text-muted-foreground">
            Matériel de réfrigération sélectionné pour les professionnels.
          </p>
        </div>

        <form className="mb-6 flex flex-col gap-3 sm:flex-row" action="/shop">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Rechercher un produit…"
            className="min-w-0 flex-1 rounded-xl border bg-card px-4 py-3"
          />
          {category && <input type="hidden" name="category" value={category} />}
          <button className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground">
            Rechercher
          </button>
        </form>

        <div className="mb-8 flex flex-wrap gap-2">
          <Link
            href={query ? `/shop?q=${encodeURIComponent(query)}` : "/shop"}
            className={`rounded-full border px-4 py-2 text-sm ${!category ? "bg-primary text-primary-foreground" : "bg-card"}`}
          >
            Tout
          </Link>
          {categories.map((item) => {
            const href = `/shop?category=${encodeURIComponent(item.slug)}${query ? `&q=${encodeURIComponent(query)}` : ""}`;
            return (
              <Link
                key={item.slug}
                href={href}
                className={`rounded-full border px-4 py-2 text-sm ${category === item.slug ? "bg-primary text-primary-foreground" : "bg-card"}`}
              >
                {item.name}
              </Link>
            );
          })}
        </div>

        {products.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border bg-card p-12 text-center">
            <h2 className="text-xl font-semibold">Aucun produit trouvé</h2>
            <p className="mt-2 text-muted-foreground">
              Modifiez votre recherche ou choisissez une autre catégorie.
            </p>
          </div>
        )}
      </main>
    </>
  );
}
