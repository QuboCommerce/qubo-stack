import { StoreHeader } from "@/components/store/store-header";
import Link from "next/link";

export default function CheckoutCancelPage() {
  return (
    <>
      <StoreHeader />
      <main className="mx-auto max-w-2xl px-5 py-20 text-center">
        <div className="rounded-3xl border bg-card p-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            Paiement interrompu
          </p>
          <h1 className="mt-3 font-display text-5xl uppercase">
            Votre panier est conservé
          </h1>
          <p className="mt-5 text-muted-foreground">
            Aucun paiement n’a été effectué. Vous pouvez modifier votre panier ou
            reprendre le paiement.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/cart" className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground">
              Retour au panier
            </Link>
            <Link href="/shop" className="rounded-xl border px-6 py-3 font-semibold">
              Continuer mes achats
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
