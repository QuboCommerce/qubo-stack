/**
 * Seeds HM Froid's header/footer section groups with SiteHeader/SiteFooter and
 * publishes them. Idempotent: replaces the draft content each run.
 *
 *   cd packages/studio && bun --env-file=../../.env scripts/seed-hm-froid-chrome.ts
 */
import { instantiate, registry } from "@qubo/blocks";
import { db } from "@qubo/db/client";
import { category, site } from "@qubo/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { getDocument, notifyRevalidate, publish, saveDraft, sectionGroupDocumentId } from "../src";

const SLUG = "hm-froid";
const EMAIL = "info@hmfroid.be";
const NAV_CATEGORIES = ["froid-commercial", "cuisson", "preparation", "fours", "inox-neutre", "lavage", "cafeteria-bar", "pizzeria-pasta", "ventilation"];

const [s] = await db.select({ id: site.id }).from(site).where(eq(site.slug, SLUG));
if (!s) throw new Error(`site ${SLUG} not found`);

const roots = await db
  .select({ name: category.name, slug: category.slug })
  .from(category)
  .where(and(eq(category.siteId, s.id), isNull(category.parentId)))
  .orderBy(asc(category.position));
const bySlug = new Map(roots.map((c) => [c.slug, c]));
const title = (name: string) => name.toLowerCase().replace(/(^|[\s-])\S/g, (m) => m.toUpperCase());
const collection = (slug: string) => ({ kind: "collection", value: slug });
const url = (path: string) => ({ kind: "url", value: path });
const shopLinks = NAV_CATEGORIES.filter((slug) => bySlug.has(slug)).map((slug) => ({ label: title(bySlug.get(slug)!.name), link: collection(slug) }));

const header = instantiate(registry, "SiteHeader", {
  props: {
    name: "HM FROID",
    searchPlaceholder: "Rechercher un équipement",
    links: [
      { label: "Boutique", link: collection("all"), children: shopLinks },
      { label: "Froid commercial", link: collection("froid-commercial"), children: [] },
      { label: "Cuisson", link: collection("cuisson"), children: [] },
      { label: "Promotions", link: collection("nos-promotions"), children: [] },
      { label: "Occasions", link: collection("nos-occasions"), children: [] },
    ],
    ctaLabel: "Demander un devis",
    ctaLink: { kind: "email", value: EMAIL },
  },
});

const footer = instantiate(registry, "SiteFooter", {
  props: {
    name: "HM FROID",
    blurb: "Réfrigération professionnelle et équipement horeca pour les professionnels en Belgique.",
    columns: [
      { title: "Boutique", links: shopLinks.slice(0, 6) },
      {
        title: "Offres",
        links: [
          { label: "Promotions", link: collection("nos-promotions") },
          { label: "Occasions", link: collection("nos-occasions") },
          { label: "Déstockage", link: collection("destockage") },
          { label: "Liquidation", link: collection("liquidation") },
        ],
      },
      {
        title: "Mon compte",
        links: [
          { label: "Se connecter", link: url("/account") },
          { label: "Panier", link: url("/cart") },
          { label: "Recherche", link: url("/search") },
        ],
      },
    ],
    email: EMAIL,
    address: "Belgique",
    legal: "© {year} {site}. Tous droits réservés.",
  },
});

for (const [kind, node] of [["header", header], ["footer", footer]] as const) {
  const id = await sectionGroupDocumentId(s.id, kind);
  if (!id) throw new Error(`no ${kind} section group for ${SLUG}`);
  const scope = { siteId: s.id };
  const doc = await getDocument(scope, id);
  await saveDraft(scope, { id, data: { ...doc.draft, content: [node] }, baseVersion: doc.draftVersion });
  const r = await publish(scope, { id, label: `Seed ${kind}` });
  console.log(`${kind}: published v${r.version}`);
}
console.log("revalidate", await notifyRevalidate(SLUG, []));
process.exit(0);
