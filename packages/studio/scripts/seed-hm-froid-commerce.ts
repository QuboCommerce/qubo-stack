/**
 * Seeds HM Froid's product, cart, search, account and maintenance templates with the commerce
 * blocks (French copy) and publishes them. Idempotent.
 *
 *   cd packages/studio && bun --env-file=../../.env scripts/seed-hm-froid-commerce.ts
 */
import { instantiate, registry } from "@qubo/blocks";
import { db } from "@qubo/db/client";
import { site } from "@qubo/db/schema";
import { eq } from "drizzle-orm";
import { getDocument, notifyRevalidate, publish, saveDraft, templateDocumentId, type ResourceKind } from "../src";

const SLUG = "hm-froid";
const [s] = await db.select({ id: site.id }).from(site).where(eq(site.slug, SLUG));
if (!s) throw new Error(`site ${SLUG} not found`);

const heading = (text: string, intro?: string) =>
  instantiate(registry, "RichText", {
    props: {
      align: "start",
      section: { width: "wide", spacingBottom: "none" },
      content: [
        { type: "Heading", props: { text, level: "h1" } },
        ...(intro ? [{ type: "Text", props: { body: `<p>${intro}</p>` } }] : []),
      ],
    },
  });

const templates: [ResourceKind, ReturnType<typeof instantiate>[]][] = [
  [
    "product",
    [
      instantiate(registry, "ProductDetail", {
        props: {
          section: { width: "wide", spacingTop: "lg" },
          secondaryLabel: "Demander un devis",
          secondaryLink: { kind: "url", value: "/#contact" },
          notes: [
            { icon: "truck", text: "Livraison et installation partout en Belgique" },
            { icon: "shield-check", text: "Paiement sécurisé par carte ou Bancontact" },
            { icon: "wrench", text: "Service après-vente et entretien" },
          ],
          labels: {
            add: "Ajouter au panier",
            added: "Ajouté au panier.",
            viewCart: "Voir le panier",
            soldOut: "Épuisé",
            option: "Option",
            quantity: "Quantité",
          },
        },
      }),
      instantiate(registry, "ProductGrid", {
        props: {
          header: { title: "Vous aimerez aussi", align: "start" },
          source: "newest",
          limit: 4,
          section: { width: "wide" },
        },
      }),
    ],
  ],
  [
    "cart",
    [
      heading("Votre panier"),
      instantiate(registry, "Cart", {
        props: {
          section: { width: "wide", spacingTop: "md" },
          emptyText: "Votre panier est vide.",
          continueLabel: "Continuer mes achats",
          continueLink: { kind: "collection", value: "all" },
          checkoutLabel: "Passer au paiement sécurisé",
          note: "TVA et livraison calculées au paiement.",
          labels: {
            subtotal: "Sous-total",
            remove: "Supprimer",
            quantity: "Quantité",
            redirecting: "Redirection…",
            error: "Le paiement est momentanément indisponible. Réessayez ou contactez-nous.",
          },
        },
      }),
    ],
  ],
  [
    "search",
    [
      heading("Recherche"),
      instantiate(registry, "ProductGrid", {
        props: {
          header: { title: "", align: "start" },
          source: "search",
          limit: 24,
          emptyText: "Aucun produit ne correspond à votre recherche.",
          section: { width: "wide", spacingTop: "md" },
        },
      }),
    ],
  ],
  [
    "account",
    [
      heading("Mon compte"),
      instantiate(registry, "Account", {
        props: {
          section: { width: "wide", spacingTop: "md" },
          greeting: "Bonjour, {name}",
          ordersTitle: "Vos commandes",
          noOrders: "Vous n'avez pas encore passé de commande.",
          form: {
            signInTab: "Se connecter",
            signUpTab: "Créer un compte",
            name: "Nom complet",
            email: "E-mail",
            password: "Mot de passe (8 caractères min.)",
            signIn: "Se connecter",
            signUp: "Créer mon compte",
            signOut: "Se déconnecter",
            openPanel: "Ouvrir Qubo",
          },
          errors: {
            invalidCredentials: "E-mail ou mot de passe incorrect.",
            emailTaken: "Un compte existe déjà pour cet e-mail. Connectez-vous.",
            weakPassword: "Utilisez au moins 8 caractères.",
            error: "Une erreur est survenue. Réessayez.",
          },
          statuses: {
            PENDING: "En attente",
            CONFIRMED: "Confirmée",
            PROCESSING: "En préparation",
            SHIPPED: "Expédiée",
            DELIVERED: "Livrée",
            COMPLETED: "Terminée",
            CANCELLED: "Annulée",
            REFUNDED: "Remboursée",
          },
        },
      }),
    ],
  ],
  [
    "maintenance",
    [heading("Nous revenons très vite", "Notre boutique est en cours de maintenance. Pour toute urgence, appelez-nous ou écrivez-nous.")],
  ],
];

const scope = { siteId: s.id };
for (const [kind, content] of templates) {
  const id = await templateDocumentId(s.id, kind);
  if (!id) throw new Error(`no ${kind} template for ${SLUG}`);
  const doc = await getDocument(scope, id);
  await saveDraft(scope, { id, data: { ...doc.draft, content }, baseVersion: doc.draftVersion });
  const r = await publish(scope, { id, label: `Seed ${kind}` });
  console.log(`${kind}: published v${r.version}`);
}
console.log("revalidate", await notifyRevalidate(SLUG, []));
process.exit(0);
