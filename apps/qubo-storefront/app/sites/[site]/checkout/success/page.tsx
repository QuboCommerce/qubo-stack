import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClearCart, instantiate, registry } from "@qubo/blocks";
import { RenderView, viewMetadata } from "@/lib/render";
import { getStorefront, hostFromParam } from "@/lib/site";
import { hasCapability } from "@/lib/template-page";

type Params = Promise<{ site: string }>;

const copy: Record<string, { title: string; body: string; cta: string }> = {
  fr: { title: "Merci pour votre commande", body: "Votre paiement a bien été reçu. Vous recevrez une confirmation par e-mail et nous vous contacterons pour la livraison.", cta: "Retour à l’accueil" },
  nl: { title: "Bedankt voor je bestelling", body: "Je betaling is ontvangen. Je ontvangt een bevestiging per e-mail en we nemen contact op voor de levering.", cta: "Terug naar home" },
  en: { title: "Thank you for your order", body: "Your payment was received. You will get a confirmation email and we will contact you about delivery.", cta: "Back to home" },
};

async function load(params: Params) {
  const sf = await getStorefront(hostFromParam((await params).site));
  if (!sf || !hasCapability(sf, "commerce")) return null;
  return { sf, t: copy[sf.site.locale.split("-")[0]] ?? copy.en };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const hit = await load(params);
  if (!hit) return {};
  return { ...(await viewMetadata(hit.sf, { title: hit.t.title })), robots: { index: false, follow: false } };
}

export default async function CheckoutSuccess({ params }: { params: Params }) {
  const hit = await load(params);
  if (!hit) notFound();
  const { sf, t } = hit;
  const body = {
    root: { props: {} },
    content: [
      instantiate(registry, "RichText", {
        props: {
          align: "center",
          content: [
            { type: "Heading", props: { text: t.title, level: "h1" } },
            { type: "Text", props: { body: `<p>${t.body}</p>` } },
            { type: "Button", props: { label: t.cta, link: { kind: "url", value: "/" } } },
          ],
        },
      }),
    ],
  };
  return (
    <>
      <RenderView sf={sf} body={body} />
      <ClearCart siteId={sf.site.id} />
    </>
  );
}
