import { ClearCart } from "@/components/store/clear-cart";
import { StoreHeader } from "@/components/store/store-header";
import { stripeRequest } from "@/lib/stripe";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Session = {
  id: string;
  payment_status: string;
  customer_details?: { email?: string | null } | null;
};

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string | string[] }>;
}) {
  const value = (await searchParams).session_id;
  const sessionId = typeof value === "string" && /^cs_[A-Za-z0-9_]+$/.test(value) ? value : null;
  let session: Session | null = null;

  if (sessionId) {
    try {
      session = await stripeRequest<Session>(
        `/checkout/sessions/${encodeURIComponent(sessionId)}`,
      );
    } catch {
      session = null;
    }
  }

  const paid = session?.payment_status === "paid";
  return (
    <>
      <StoreHeader />
      <main className="mx-auto max-w-2xl px-5 py-20 text-center">
        {paid && <ClearCart />}
        <div className="rounded-3xl border bg-card p-10 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            {paid ? "Paiement confirmé" : "Confirmation en cours"}
          </p>
          <h1 className="mt-3 font-display text-5xl uppercase">
            {paid ? "Merci pour votre commande" : "Nous vérifions votre paiement"}
          </h1>
          <p className="mt-5 text-muted-foreground">
            {paid
              ? `Votre commande a bien été reçue${session?.customer_details?.email ? ` et un reçu sera envoyé à ${session.customer_details.email}` : ""}.`
              : "La confirmation n’est pas encore disponible. Contactez-nous si le paiement apparaît sur votre relevé."}
          </p>
          <Link
            href="/shop"
            className="mt-8 inline-block rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground"
          >
            Retour à la boutique
          </Link>
        </div>
      </main>
    </>
  );
}
