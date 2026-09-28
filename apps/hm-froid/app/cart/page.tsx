import { CartView } from "@/components/store/cart-view";
import { StoreHeader } from "@/components/store/store-header";

export default function CartPage() {
  return (
    <>
      <StoreHeader />
      <main className="mx-auto max-w-4xl px-5 py-12">
        <h1 className="font-display text-5xl uppercase">Votre panier</h1>
        <CartView />
      </main>
    </>
  );
}
