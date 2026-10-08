/**
 * HM Froid: builds the whole site (theme, header, footer, templates, pages)
 * from code so it can be replayed on any environment that holds the site.
 *
 *   set -a; . ./.env; set +a; bun run scripts/sites/hm-froid.ts
 *
 * Everything it writes is a published draft in the Studio, so merchants can
 * keep editing afterwards. Re-running overwrites the documents it owns and
 * leaves other pages alone. Facts (company, hours, delivery zones, warranty)
 * live in `docs/plans/hm-froid.md`; the copy here is the French master, the
 * Dutch overlay (`hm-froid.nl.ts`) is written as translation rows right after
 * each publish, matched on the French text.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@qubo/db/client";
import { asset, page, sectionGroup, site, siteLocale, template, theme } from "@qubo/db/schema";
import { instantiate, registry, validateDocument, type DocumentData, type SlotNode } from "@qubo/blocks";
import { hmFroidTheme } from "@qubo/stylekit";
import { mediaUrl } from "@qubo/storage";
import {
  createPage,
  forceSaveDraft,
  getDocument,
  getTheme,
  listPages,
  notifyRevalidate,
  publish,
  publishTheme,
  saveThemeDraft,
  stringsOf,
  translationPath,
  updatePage,
  upsertDocumentTranslations,
  upsertPageTranslations,
  upsertSiteTranslations,
  type Scope,
} from "@qubo/studio";
import { nl, nlPages } from "./hm-froid.nl";
import { chapterFooterDoc, chapterHomeDoc, chapterMedia, mastheadDoc } from "./hm-froid.chapters";

const SITE_SLUG = process.env.HM_FROID_SITE_SLUG || "hm-froid";
const NL = "nl-BE";

// ------------------------------------------------------------------ facts ---

const company = {
  legal: "H.M. Catering Equipment s.a.",
  brand: "HM Froid",
  vat: "BE 0859.752.174",
  street: "Avenue Raymond Vanderbruggen 18-20",
  city: "1070 Anderlecht (Bruxelles)",
  phone: "+32 2 411 80 02",
  phoneLink: "+3224118002",
  fax: "+32 2 411 80 03",
  email: "info@hmfroid.be",
  hours: "Lun-Ven : 9h-18h\nSam : 10h-16h",
  since: "2008",
  catalogue: "plus de 3 900 produits",
};

const zones: [string, string][] = [
  ["Offerte", "dès 1 500 € HTVA"],
  ["25 €", "Bruxelles"],
  ["50 €", "Brabant wallon"],
  ["50 €", "Brabant flamand"],
  ["65 €", "Hainaut"],
  ["60 €", "Namur"],
  ["75 €", "Liège"],
  ["150 €", "Luxembourg"],
  ["100 €", "Limbourg"],
  ["60 €", "Anvers"],
  ["70 €", "Flandre occidentale"],
  ["65 €", "Flandre orientale"],
];

const brands: [name: string, text: string][] = [
  ["Bertos", "Cuisson professionnelle italienne : fourneaux, friteuses, plaques."],
  ["MBM", "Gammes de cuisson modulaires Minima, Domina, Magistra."],
  ["Robot Coupe", "Cutters, coupe-légumes et combinés pour la préparation."],
  ["Tefcold", "Armoires, vitrines et bahuts réfrigérés."],
  ["Hällde", "Coupe-légumes et combinés suédois."],
  ["Henkovac", "Machines sous vide."],
  ["Santos", "Presse-agrumes, blenders et moulins pour le bar."],
  ["Dexion", "Rayonnages pour chambres froides et réserves."],
  ["Angelo Forni", ""],
  ["Broaster", "Friteuses à pression."],
  ["Da Venix", ""],
  ["Gargano", "Cutters professionnels."],
  ["Kisag", ""],
  ["Knox", ""],
  ["Modular", "Cuisson modulaire."],
  ["Potis", "Grills à gyros et kebab."],
  ["Ronda", ""],
  ["Vulcan", ""],
  ["Wooster", "Cellules de refroidissement rapide."],
];

// ------------------------------------------------------------------ nodes ---

type Props = Record<string, unknown>;
type Link = { kind: "url" | "page" | "collection" | "anchor" | "email" | "phone"; value: string };

const pageLink = (slug: string): Link => ({ kind: "page", value: slug });
const collectionLink = (handle: string): Link => ({ kind: "collection", value: handle });
const url = (value: string): Link => ({ kind: "url", value });
const phoneLink: Link = { kind: "phone", value: company.phoneLink };
const emailLink: Link = { kind: "email", value: company.email };

/** A child node without id (instantiate assigns ids and defaults). */
const node = (type: string, props: Props = {}): SlotNode => ({ type, props: props as SlotNode["props"] });
const section = (type: string, props: Props = {}): SlotNode => instantiate(registry, type, { props });

const chrome = (o: Props) => ({ section: o });
const heading = (text: string, o: Props = {}) => node("Heading", { text, level: "h2", align: "inherit", ...o });
const h1 = (text: string, o: Props = {}) => heading(text, { level: "h1", size: "5", font: "display", ...o });
const text = (body: string, o: Props = {}) => node("Text", { body, ...o });
const p = (...paras: string[]) => text(paras.map((s) => `<p>${s}</p>`).join(""));
const eyebrow = (t: string, o: Props = {}) => node("Eyebrow", { text: t, look: "text", align: "inherit", ...o });
const button = (label: string, link: Link, emphasis: "primary" | "outline" | "ghost" = "primary", o: Props = {}) => node("Button", { label, link, emphasis, ...o });
const buttons = (...items: SlotNode[]) => node("ButtonGroup", { buttons: items, align: "start", gap: "xs" });
const list = (items: string[], marker = "check") => node("List", { items: items.map((t) => ({ text: t })), marker });

function article(title: string, intro: string, sections: [string, string | string[]][], extra: SlotNode[] = []): DocumentData {
  const content = [
    h1(title),
    p(intro),
    ...sections.flatMap(([hd, body]) => [heading(hd, { size: "3" }), Array.isArray(body) ? list(body, "bullet") : text(body.startsWith("<") ? body : `<p>${body}</p>`)]),
  ];
  return { root: { props: { title } }, content: [section("RichText", { content, align: "start", ...chrome({ spacingTop: "xl", spacingBottom: "xl" }) }), ...extra] };
}

const contactBand = (title = "Une question sur un équipement ?", body = "Un conseiller vous répond au showroom ou par téléphone, du lundi au samedi.") =>
  section("CtaBand", {
    content: [heading(title, { size: "4", font: "display" }), p(body), buttons(button("Appeler le " + company.phone, phoneLink, "primary", { icon: "phone" }), button("Écrire un message", pageLink("contact"), "outline"))],
    layout: "row",
    ...chrome({ scheme: "graphite", width: "wide", spacingTop: "xl", spacingBottom: "xl" }),
  });

// ------------------------------------------------------------------ media ---

type Media = { assetId: string; url: string; alt: string; width: number; height: number };

async function findMedia(orgId: string, filenamePrefix: string): Promise<Media | undefined> {
  const rows = await db.select().from(asset).where(eq(asset.organizationId, orgId));
  const hit = rows.find((r) => r.filename.startsWith(filenamePrefix));
  if (!hit) return undefined;
  const ext = hit.filename.split(".").pop() || "webp";
  return { assetId: hit.id, url: mediaUrl(orgId, hit.id, ext), alt: hit.alt, width: hit.width ?? 0, height: hit.height ?? 0 };
}

// -------------------------------------------------------------- documents ---

function collectionDoc(all: boolean): DocumentData {
  return {
    root: { props: { title: all ? "Catalogue" : "Collection" } },
    content: [
      section("CollectionHeader", {
        homeLabel: "Accueil",
        allTitle: "Tous les rayons",
        countLabel: "{n} produits",
        showDescription: true,
        showChildren: true,
        showCount: true,
        align: "start",
        ...chrome({ spacingTop: "lg", spacingBottom: "sm" }),
      }),
      section("ProductGrid", {
        header: { eyebrow: "", title: "", intro: "", align: "start" },
        source: "collection",
        collection: "",
        limit: 24,
        columns: { base: 2, md: 3, lg: 4 },
        emptyText: "Ce rayon se remplit. Appelez-nous pour connaître le stock du moment.",
        ...chrome({ spacingTop: "sm", spacingBottom: "2xl" }),
      }),
      contactBand("Vous ne trouvez pas la bonne référence ?", "Décrivez-nous votre besoin : nous avons souvent l'équivalent en stock ou en commande fournisseur."),
    ],
  };
}

function productDoc(): DocumentData {
  return {
    root: { props: { title: "Produit" } },
    content: [
      section("ProductDetail", {
        showBrand: true,
        showSku: true,
        showDescription: true,
        imageAspect: "1/1",
        secondaryLabel: "Demander un devis",
        secondaryLink: pageLink("contact"),
        notes: [
          { icon: "truck", text: "Livraison assurée en Belgique, offerte dès 1 500 € HTVA" },
          { icon: "shield-check", text: "Garantie 1 an pièces (neuf), 6 mois (occasion)" },
          { icon: "phone", text: `Conseil au ${company.phone}, du lundi au samedi` },
        ],
        labels: { add: "Ajouter au panier", added: "Ajouté à votre panier.", viewCart: "Voir le panier", soldOut: "Sur commande", option: "Option", quantity: "Quantité" },
        ...chrome({ spacingTop: "lg", spacingBottom: "2xl" }),
      }),
      section("ProductGrid", {
        header: { eyebrow: "", title: "Dans le même rayon", intro: "", align: "start", titleSize: "3" },
        source: "collection",
        collection: "",
        limit: 8,
        columns: { base: 2, md: 3, lg: 4 },
        emptyText: "",
        ...chrome({ spacingTop: "lg", spacingBottom: "2xl" }),
      }),
    ],
  };
}

function notFoundDoc(): DocumentData {
  return {
    root: { props: { title: "Page introuvable" } },
    content: [
      section("RichText", {
        content: [eyebrow("Erreur 404"), h1("Cette page n'existe pas ou plus"), p("Le catalogue a changé d'adresse. Reprenez depuis l'accueil ou cherchez directement un équipement."), buttons(button("Retour à l'accueil", pageLink("home"), "primary"), button("Voir le catalogue", collectionLink("all"), "outline"))],
        align: "center",
        ...chrome({ spacingTop: "3xl", spacingBottom: "3xl" }),
      }),
    ],
  };
}

// ------------------------------------------------------------------ pages ---

type PageSpec = { slug: string; title: string; metaTitle?: string; metaDescription: string; doc: DocumentData };

function pages(split?: Media): PageSpec[] {
  const contactDetails = { show: true, phone: company.phone, email: company.email, address: `${company.street}\n${company.city}`, hours: company.hours };
  const tradePage = (slug: string, title: string, h: string, intro: string, body: string, rows: [string, string, string][], key: string, meta: string): PageSpec => ({
    slug,
    title,
    metaTitle: `${title} : matériel professionnel neuf et d'occasion`,
    metaDescription: meta,
    doc: {
      root: { props: { title: h } },
      content: [
        section("RichText", { content: [eyebrow("Par métier"), h1(h), text(`<p>${intro}</p>`, { size: "1", tone: "muted" }), p(body)], align: "start", ...chrome({ spacingTop: "xl", spacingBottom: "md" }) }),
        section("CardGrid", {
          header: { eyebrow: "", title: "Les rayons utiles", intro: "", align: "start", titleSize: "3" },
          columns: { base: 1, md: 2, lg: 3 },
          cards: rows.map(([t, handle, blurb]) => node("Card", { look: "outline", hover: "lift", link: collectionLink(handle), content: [heading(t, { level: "h3", size: "2", font: "heading" }), text(`<p>${blurb}</p>`, { size: "-1", tone: "muted" })] })),
          ...chrome({ spacingTop: "md", spacingBottom: "lg" }),
        }),
        section("ProductGrid", {
          header: { eyebrow: "", title: "Quelques références", intro: "", cta: { label: "Voir tout le rayon", link: collectionLink(key) }, align: "start", titleSize: "3" },
          source: "collection",
          collection: key,
          limit: 8,
          columns: { base: 2, md: 3, lg: 4 },
          emptyText: "Appelez-nous pour le stock du moment.",
          ...chrome({ spacingTop: "lg", spacingBottom: "2xl" }),
        }),
        contactBand("Un projet d'ouverture ou de rénovation ?", "Venez avec votre plan au showroom : on dimensionne ensemble le froid, la cuisson et l'inox."),
      ],
    },
  });

  return [
    {
      slug: "qui-sommes-nous",
      title: "Qui sommes-nous",
      metaTitle: "Qui sommes-nous",
      metaDescription: `HM Froid vend du matériel horeca neuf et d'occasion à Anderlecht depuis ${company.since}. Showroom, atelier, livraison en Belgique et rachat de matériel.`,
      doc: article(
        "Qui sommes-nous",
        `HM Froid est le nom commercial de ${company.legal}, fournisseur de matériel horeca à Anderlecht depuis ${company.since}. Nous vendons aux professionnels de bouche : restaurants, friteries, boucheries, boulangeries, snacks, traiteurs et collectivités.`,
        [
          ["Ce que nous faisons", ["Vente de matériel neuf : froid commercial, cuisson, inox, préparation, lavage, ventilation", "Vente de matériel d'occasion révisé en atelier", "Livraison assurée partout en Belgique et retrait au dépôt", "Service après-vente, pièces et interventions", "Rachat et reprise de votre matériel actuel"]],
          ["Ce que nous ne faisons pas", "Nous ne faisons pas l'installation. Nous livrons et déposons le matériel à l'endroit convenu ; le raccordement eau, gaz ou électricité se fait avec votre installateur. Cela nous permet de rester concentrés sur le choix du matériel et son suivi."],
          ["Le showroom", `${company.street}, ${company.city}. Ouvert du lundi au vendredi de 9h à 18h et le samedi de 10h à 16h. Vous pouvez voir et toucher une grande partie du catalogue avant de décider.`],
          ["Les marques", "Bertos, MBM, Robot Coupe, Tefcold, Hällde, Henkovac, Santos, Wooster, Potis, Gargano et d'autres fabricants européens. Nous choisissons des marques pour lesquelles nous pouvons fournir des pièces."],
        ],
        [contactBand("Envie de voir le matériel ?", "Le showroom est ouvert six jours sur sept. Appelez pour vérifier qu'une référence est exposée.")],
      ),
    },
    {
      slug: "contact",
      title: "Contact",
      metaTitle: "Contact et showroom à Anderlecht",
      metaDescription: `Showroom HM Froid, ${company.street}, ${company.city}. ${company.phone}. Lun-Ven 9h-18h, Sam 10h-16h. Devis et conseils pour votre matériel horeca.`,
      doc: {
        root: { props: { title: "Contact" } },
        content: [
          section("RichText", { content: [h1("Contact et showroom"), text("<p>Pour un devis, une question sur une référence ou une reprise de matériel. Nous répondons en français et en néerlandais, en semaine comme le samedi matin.</p>", { size: "1", tone: "muted" })], align: "start", ...chrome({ spacingTop: "xl", spacingBottom: "sm" }) }),
          section("ContactForm", {
            fields: [
              { label: "Société", name: "company", type: "text", required: true, options: "", width: "half" },
              { label: "Nom", name: "name", type: "text", required: true, options: "", width: "half" },
              { label: "E-mail", name: "email", type: "email", required: true, options: "", width: "half" },
              { label: "Téléphone", name: "phone", type: "tel", required: false, options: "", width: "half" },
              { label: "Message", name: "message", type: "textarea", required: true, options: "", width: "full" },
            ],
            header: { eyebrow: "", title: "Nous écrire", intro: "", align: "start", titleSize: "3" },
            submitLabel: "Envoyer",
            successMessage: "Merci, nous revenons vers vous dans la journée ouvrable.",
            formKey: "contact",
            details: contactDetails,
            ...chrome({ spacingTop: "sm", spacingBottom: "xl" }),
          }),
          section("Map", {
            header: { eyebrow: "", title: "Nous rendre visite", intro: "", align: "start" },
            address: `${company.street}, ${company.city}, Belgique`,
            height: "md",
            showDetails: false,
            directionsLabel: "Itinéraire",
            ...chrome({ width: "wide", spacingTop: "sm", spacingBottom: "2xl" }),
          }),
        ],
      },
    },
    {
      slug: "livraison-et-paiement",
      title: "Livraison et paiement",
      metaTitle: "Livraison en Belgique et paiement",
      metaDescription: "Livraison assurée partout en Belgique, offerte dès 1 500 € HTVA. Tarifs par province, retrait au dépôt, acompte et moyens de paiement.",
      doc: {
        root: { props: { title: "Livraison et paiement" } },
        content: [
          section("RichText", {
            content: [
              h1("Livraison et paiement"),
              text("<p>Nous livrons nous-mêmes en Belgique. Toutes nos livraisons sont assurées jusqu'à la remise au client. Le matériel est déposé à l'adresse convenue, au rez-de-chaussée ou à l'endroit accessible au transpalette.</p>", { size: "1", tone: "muted" }),
              heading("Tarifs de livraison en Belgique", { size: "3" }),
              p("Prix hors TVA, par livraison. La livraison est offerte dès 1 500 € HTVA de commande."),
            ],
            align: "start",
            ...chrome({ spacingTop: "xl", spacingBottom: "sm" }),
          }),
          section("Section", {
            content: [node("Grid", { columns: { base: 2, md: 3, lg: 4 }, gap: "sm", items: zones.map(([v, l]) => node("Card", { look: "outline", padding: "sm", content: [node("Stat", { value: v, label: l, align: "start" })] })) })],
            ...chrome({ spacingTop: "sm", spacingBottom: "lg" }),
          }),
          section("RichText", {
            content: [
              heading("Hors Belgique", { size: "3" }),
              p("Les livraisons à l'étranger se font par transporteur, aux frais du client et sur devis. Le matériel voyage alors aux risques de l'acheteur."),
              heading("Retrait au dépôt", { size: "3" }),
              p(`Vous pouvez enlever votre commande à Anderlecht du lundi au vendredi de 9h à 17h, après confirmation de notre part. Le chargement se fait sous votre responsabilité.`),
              heading("À la réception", { size: "3" }),
              p("Vérifiez le matériel en présence du livreur. Tout dommage ou manquant doit être noté sur le bon de livraison pour être pris en charge."),
              heading("Paiement", { size: "3" }),
              p("Un acompte de 40 % est demandé à la commande, le solde avant la livraison ou l'enlèvement. Les prix du site sont indiqués hors TVA."),
              list(["Virement bancaire (BNP Paribas Fortis, KBC ou ING, coordonnées sur le devis)", "Bancontact", "Visa et Mastercard", "Apple Pay"], "check"),
            ],
            align: "start",
            ...chrome({ spacingTop: "lg", spacingBottom: "2xl" }),
          }),
        ],
      },
    },
    {
      slug: "garantie-et-sav",
      title: "Garantie et service après-vente",
      metaTitle: "Garantie et SAV matériel horeca",
      metaDescription: "Garantie 1 an sur le neuf, 6 mois sur l'occasion. Interventions du lundi au vendredi, pièces et conseils. Ce que la garantie couvre et ce qu'elle exclut.",
      doc: article(
        "Garantie et service après-vente",
        "Le matériel que nous vendons travaille dur. Voici ce que nous garantissons, pendant combien de temps, et comment se passe une intervention.",
        [
          ["Durée de la garantie", ["Matériel neuf : 1 an pièces pour un usage professionnel", "Matériel d'occasion : 6 mois pour un usage professionnel, après révision en atelier", "Revendeurs : 1 an sur les pièces uniquement"]],
          ["Ce que la garantie ne couvre pas", ["Les consommables : joints, filtres, lampes, vitres", "Les dégâts liés au calcaire ou à un défaut d'entretien", "Les pannes dues à un mauvais raccordement ou à une utilisation hors usage prévu", "Le transport du matériel vers l'atelier"]],
          ["Interventions", "Notre atelier et nos techniciens interviennent du lundi au vendredi de 8h30 à 17h. En dehors de ces heures, une intervention reste possible moyennant un forfait de 150 € HTVA, en plus des pièces."],
          ["Comment faire une demande", `Appelez le ${company.phone} ou écrivez à ${company.email} avec le modèle, le numéro de série et une description de la panne. Une photo de la plaque signalétique accélère le diagnostic.`],
          ["Entretien", "Un nettoyage régulier des condenseurs et des filtres évite la majorité des pannes sur le froid. Nous vous expliquons les gestes utiles à la livraison."],
        ],
        [contactBand("Une panne ?", "Décrivez-la nous avec le modèle et le numéro de série : nous planifions l'intervention ou commandons la pièce.")],
      ),
    },
    {
      slug: "mentions-legales",
      title: "Mentions légales",
      metaTitle: "Mentions légales",
      metaDescription: `Éditeur du site hmfroid.be : ${company.legal}, Anderlecht. Numéro d'entreprise, coordonnées et hébergement.`,
      doc: article(
        "Mentions légales",
        `Ce site est édité par ${company.legal}, exploitant la marque ${company.brand}.`,
        [
          ["Éditeur", `${company.legal}, société anonyme de droit belge. Siège : ${company.street}, ${company.city}. Numéro d'entreprise et TVA : ${company.vat}.`],
          ["Contact", `Téléphone : ${company.phone}. Fax : ${company.fax}. E-mail : ${company.email}.`],
          ["Hébergement", "Le site est hébergé sur un serveur privé situé dans l'Union européenne et administré pour le compte de l'éditeur."],
          ["Propriété intellectuelle", "Les textes, photos, logos et la structure de ce site sont la propriété de l'éditeur ou de ses fournisseurs. Toute reproduction sans accord écrit est interdite. Les marques citées appartiennent à leurs propriétaires respectifs."],
          ["Responsabilité", "Les informations du catalogue (dimensions, puissances, prix) sont fournies par les fabricants et peuvent évoluer. Elles sont confirmées sur le devis avant toute commande."],
        ],
      ),
    },
    {
      slug: "politique-de-confidentialite",
      title: "Politique de confidentialité",
      metaTitle: "Politique de confidentialité",
      metaDescription: "Quelles données HM Froid collecte via le site, pourquoi, combien de temps elles sont gardées et comment exercer vos droits.",
      doc: article(
        "Politique de confidentialité",
        `${company.legal} est responsable du traitement des données collectées sur ce site. Nous collectons le minimum nécessaire pour répondre à vos demandes et traiter vos commandes.`,
        [
          ["Données collectées", ["Formulaires de contact, de devis et de rachat : société, nom, e-mail, téléphone, message", "Compte client : identifiants, coordonnées de facturation et de livraison, historique de commandes", "Données techniques nécessaires au fonctionnement du site : adresse IP, journaux de connexion"]],
          ["Pourquoi", ["Répondre à vos demandes et établir des devis", "Exécuter et suivre vos commandes, livraisons et garanties", "Respecter nos obligations comptables et fiscales"]],
          ["Combien de temps", "Les demandes de contact sont conservées deux ans après le dernier échange. Les données liées à une facture sont conservées dix ans, durée légale en Belgique. Un compte client inactif est supprimé après trois ans."],
          ["Avec qui", "Vos données ne sont pas vendues. Elles sont partagées uniquement avec les prestataires nécessaires à l'exécution : transporteur, prestataire de paiement, hébergeur, comptable."],
          ["Cookies", "Le site utilise uniquement des cookies techniques : session, panier et connexion au compte. Aucun cookie publicitaire ni de suivi tiers n'est déposé."],
          ["Vos droits", `Vous pouvez demander l'accès, la rectification, la suppression ou la portabilité de vos données en écrivant à ${company.email}. Vous pouvez aussi introduire une réclamation auprès de l'Autorité de protection des données (APD).`],
        ],
      ),
    },
    {
      slug: "conditions-generales",
      title: "Conditions générales de vente",
      metaTitle: "Conditions générales de vente",
      metaDescription: "Conditions de vente HM Froid : devis, acompte de 40 %, délais, livraison, réserve de propriété, garantie et litiges.",
      doc: article(
        "Conditions générales de vente",
        `Ces conditions s'appliquent à toute vente conclue par ${company.legal} avec un acheteur professionnel. Toute commande vaut acceptation de ces conditions.`,
        [
          ["Offres et prix", "Nos devis sont valables trente jours sauf mention contraire. Les prix s'entendent hors TVA, départ dépôt, livraison en sus selon le tarif en vigueur."],
          ["Commande et acompte", "La commande est ferme à réception de l'acompte de 40 %. Le solde est payable avant la livraison ou l'enlèvement. Aucun matériel ne quitte le dépôt sans paiement complet."],
          ["Délais", "Les délais de livraison sont donnés à titre indicatif. Un retard ne peut donner lieu ni à l'annulation de la commande ni à une indemnité."],
          ["Livraison et transfert des risques", "Les livraisons effectuées par nos soins en Belgique sont assurées jusqu'à la remise. Les expéditions par transporteur tiers voyagent aux risques de l'acheteur. Toute réserve doit être écrite sur le bon de livraison."],
          ["Réserve de propriété", "Le matériel reste la propriété du vendeur jusqu'au paiement intégral du prix."],
          ["Garantie", "Les conditions de garantie sont décrites sur la page Garantie et service après-vente et font partie des présentes conditions."],
          ["Retours", "Le matériel vendu n'est ni repris ni échangé, sauf accord écrit préalable. Le matériel commandé spécialement pour l'acheteur ne peut pas être annulé."],
          ["Litiges", "Le droit belge s'applique. En cas de litige, les tribunaux de l'arrondissement de Bruxelles sont seuls compétents."],
        ],
      ),
    },
    {
      slug: "questions-frequentes",
      title: "Questions fréquentes",
      metaTitle: "Questions fréquentes sur l'achat de matériel horeca",
      metaDescription: "Vente aux particuliers, installation, garantie, délais, livraison, occasions, rachat : les réponses d'HM Froid avant votre achat.",
      doc: {
        root: { props: { title: "Questions fréquentes" } },
        content: [
          section("RichText", { content: [h1("Questions fréquentes"), text("<p>Les questions qui reviennent au comptoir et au téléphone. Si la vôtre n'y est pas, appelez-nous.</p>", { size: "1", tone: "muted" })], align: "start", ...chrome({ spacingTop: "xl", spacingBottom: "sm" }) }),
          section("Faq", {
            header: { eyebrow: "", title: "", intro: "", align: "start" },
            layout: "stacked",
            openFirst: true,
            structuredData: true,
            items: [
              { question: "Vendez-vous aux particuliers ?", answer: "Non. Nous vendons aux professionnels et aux collectivités. Les prix affichés sont hors TVA." },
              { question: "Installez-vous le matériel ?", answer: "Non. Nous livrons et déposons le matériel à l'endroit convenu. Le raccordement eau, gaz ou électricité est à prévoir avec votre installateur." },
              { question: "Combien coûte la livraison ?", answer: "De 25 € HTVA à Bruxelles à 150 € HTVA au Luxembourg selon la province, et offerte dès 1 500 € HTVA de commande. Le détail est sur la page Livraison et paiement." },
              { question: "Quels sont les délais ?", answer: "Le matériel en stock part sous quelques jours. Le matériel sur commande fournisseur prend en général deux à six semaines ; le délai est confirmé sur le devis." },
              { question: "Quelle garantie sur une occasion ?", answer: "Six mois pour un usage professionnel, après révision en atelier. Le neuf est garanti un an pièces." },
              { question: "Reprenez-vous mon ancien matériel ?", answer: "Oui. Envoyez-nous des photos, la marque et le modèle via la page Rachat de matériel, nous vous faisons une proposition." },
              { question: "Puis-je venir voir avant d'acheter ?", answer: "Oui, le showroom d'Anderlecht est ouvert du lundi au vendredi de 9h à 18h et le samedi de 10h à 16h." },
              { question: "Comment payer ?", answer: "Acompte de 40 % à la commande, solde avant livraison. Par virement, Bancontact, Visa, Mastercard ou Apple Pay." },
            ],
            ...chrome({ spacingTop: "sm", spacingBottom: "2xl" }),
          }),
          contactBand(),
        ],
      },
    },
    {
      slug: "materiel-horeca-occasion",
      title: "Matériel horeca d'occasion",
      metaTitle: "Matériel horeca d'occasion révisé et garanti",
      metaDescription: "Frigos, tables réfrigérées, fourneaux et inox d'occasion révisés en atelier et garantis 6 mois. Stock renouvelé chaque semaine à Anderlecht.",
      doc: {
        root: { props: { title: "Matériel horeca d'occasion" } },
        content: [
          section("SplitMedia", {
            media: split ?? { alt: "" },
            mediaPosition: "end",
            mediaAspect: "3/2",
            mediaRadius: "sm",
            content: [
              eyebrow("Occasions"),
              h1("Matériel horeca d'occasion, révisé et garanti"),
              text("<p>Nos occasions viennent de reprises et de fins de bail. Chaque appareil passe par l'atelier : contrôle du groupe froid, des joints, des thermostats et des brûleurs, nettoyage et test en charge. Puis il est garanti six mois.</p>", { size: "1", tone: "muted" }),
              list(["Garantie 6 mois pour un usage professionnel", "Révisé et testé en atelier avant la vente", "Visible au showroom d'Anderlecht", "Stock renouvelé chaque semaine"]),
              buttons(button("Appeler pour le stock du jour", phoneLink, "primary", { icon: "phone" }), button("Faire reprendre mon matériel", pageLink("rachat-materiel-horeca"), "outline")),
            ],
            ...chrome({ scheme: "plate", width: "wide", spacingTop: "2xl", spacingBottom: "2xl", background: { gradient: "brushed", texture: "brushed-lines" } }),
          }),
          section("ProductGrid", {
            header: { eyebrow: "", title: "Occasions en ligne", intro: "Une partie du stock seulement est publiée ici. Le reste se voit au showroom.", align: "start", titleSize: "3" },
            source: "collection",
            collection: "nos-occasions",
            limit: 12,
            columns: { base: 2, md: 3, lg: 4 },
            emptyText: "Les occasions partent vite et ne sont pas toutes en ligne. Appelez-nous ou passez au showroom pour le stock du moment.",
            ...chrome({ spacingTop: "xl", spacingBottom: "2xl" }),
          }),
          section("ProductGrid", {
            header: { eyebrow: "", title: "Déstockage et fins de série", intro: "Du neuf à prix réduit : expositions, fins de série, emballages abîmés.", cta: { label: "Voir le déstockage", link: collectionLink("destockage") }, align: "start", titleSize: "3" },
            source: "collection",
            collection: "destockage",
            limit: 8,
            columns: { base: 2, md: 3, lg: 4 },
            emptyText: "Pas de déstockage en ligne pour le moment.",
            ...chrome({ spacingTop: "lg", spacingBottom: "2xl" }),
          }),
        ],
      },
    },
    {
      slug: "rachat-materiel-horeca",
      title: "Rachat de matériel horeca",
      metaTitle: "Rachat et reprise de matériel horeca",
      metaDescription: "Vous fermez, rénovez ou remplacez ? HM Froid rachète votre matériel de restauration, froid et cuisson en Belgique. Estimation sur photos, enlèvement organisé.",
      doc: {
        root: { props: { title: "Rachat de matériel horeca" } },
        content: [
          section("RichText", {
            content: [eyebrow("Reprise"), h1("Nous rachetons votre matériel horeca"), text("<p>Fermeture, rénovation, changement de carte ou remplacement : votre matériel a encore de la valeur. Nous rachetons le froid, la cuisson, l'inox et la préparation, à l'unité ou toute la cuisine.</p>", { size: "1", tone: "muted" })],
            align: "start",
            ...chrome({ spacingTop: "xl", spacingBottom: "md" }),
          }),
          section("Process", {
            header: { eyebrow: "", title: "Comment ça se passe", intro: "", align: "start", titleSize: "3" },
            layout: "horizontal",
            steps: [
              { title: "Photos et liste", text: "Envoyez-nous les photos, marques, modèles et l'année approximative via le formulaire ci-dessous.", icon: "camera" },
              { title: "Proposition", text: "Nous revenons vers vous avec un prix. Pour une cuisine complète, nous passons sur place.", icon: "calculator" },
              { title: "Enlèvement", text: "Nous organisons l'enlèvement à la date convenue et le paiement à la reprise.", icon: "truck" },
            ],
            ...chrome({ spacingTop: "md", spacingBottom: "xl" }),
          }),
          section("ContactForm", {
            fields: [
              { label: "Société", name: "company", type: "text", required: false, options: "", width: "half" },
              { label: "Nom", name: "name", type: "text", required: true, options: "", width: "half" },
              { label: "E-mail", name: "email", type: "email", required: true, options: "", width: "half" },
              { label: "Téléphone", name: "phone", type: "tel", required: true, options: "", width: "half" },
              { label: "Adresse du matériel", name: "address", type: "text", required: false, options: "", width: "full" },
              { label: "Matériel à reprendre (marques, modèles, année, état)", name: "message", type: "textarea", required: true, options: "", width: "full" },
            ],
            header: { eyebrow: "", title: "Décrivez votre matériel", intro: "", align: "start", titleSize: "3" },
            submitLabel: "Demander une estimation",
            successMessage: "Merci. Nous revenons vers vous avec une proposition sous deux jours ouvrables.",
            formKey: "rachat",
            details: { ...contactDetails, show: true },
            ...chrome({ spacingTop: "sm", spacingBottom: "2xl" }),
          }),
        ],
      },
    },
    tradePage(
      "friterie",
      "Matériel pour friterie",
      "Matériel pour friterie",
      "Friteuses haut rendement, bacs réfrigérés pour les frites fraîches, tables de travail et vitrines à snacks : l'équipement d'une friterie qui tient le coup de feu.",
      "Une friterie use son matériel plus vite qu'un restaurant. Nous privilégions des friteuses à cuve profonde et à relance rapide, de l'inox facile à nettoyer et du froid dimensionné pour des portes qui s'ouvrent souvent.",
      [
        ["Friteuses", "friteuse", "Gaz ou électrique, une à trois cuves, filtration intégrée sur certains modèles."],
        ["Friteuses haut rendement", "friteuse-haut-rendement", "Pour les files d'attente : relance rapide et grande capacité."],
        ["Tables réfrigérées", "table-refrigeree", "Frites fraîches, sauces et snacks au froid, plan de travail en inox."],
        ["Vitrines réfrigérées", "vitrine", "Boissons et snacks visibles depuis la file."],
        ["Plaques à snacker", "plaque-a-snacker", "Pour les hamburgers et les mitraillettes."],
        ["Inox neutre", "inox-neutre", "Tables, plonges et étagères pour le poste de travail."],
      ],
      "friteuse",
      "Friteuses haut rendement, tables réfrigérées, vitrines et inox pour friterie. Matériel neuf et d'occasion, livré en Belgique par HM Froid.",
    ),
    tradePage(
      "boucherie",
      "Matériel pour boucherie",
      "Matériel pour boucherie et traiteur",
      "Vitrines réfrigérées, chambres froides, trancheuses, hachoirs et scies à os : le matériel d'une boucherie, du laboratoire au comptoir.",
      "Le froid de boucherie doit tenir une température stable toute la journée, vitrine ouverte. Nous proposons des vitrines ventilées ou statiques selon les produits, des chambres froides positives et négatives et de la préparation robuste.",
      [
        ["Comptoirs réfrigérés", "comptoirs-refrigeres", "Vitrines de présentation pour la viande et le traiteur."],
        ["Chambres froides", "chambres-froides", "Positives et négatives, monoblocs fournis."],
        ["Trancheuses", "trancheuse", "À gravité ou verticales, lames de 250 à 350 mm."],
        ["Hachoirs", "hachoir", "Pour la viande hachée du jour."],
        ["Scies à os", "scie-a-os", "Pour la découpe au laboratoire."],
        ["Sous-videuses", "sous-videuse", "Conservation et vente en portions."],
      ],
      "comptoirs-refrigeres",
      "Vitrines réfrigérées, chambres froides, trancheuses, hachoirs et scies à os pour boucherie. Neuf et occasion chez HM Froid, Anderlecht.",
    ),
    tradePage(
      "restaurant",
      "Matériel pour restaurant",
      "Matériel pour restaurant et brasserie",
      "Fourneaux, fours, tables réfrigérées, lave-vaisselle et inox : tout l'équipement d'une cuisine de restaurant, à la pièce ou en projet complet.",
      "Pour une ouverture, nous partons de votre carte et du nombre de couverts pour dimensionner la cuisson, le froid et le lavage. Pour un remplacement, nous cherchons un appareil aux mêmes dimensions pour éviter de refaire le plan.",
      [
        ["Cuisson", "cuisson", "Fourneaux, plaques, friteuses, bains-marie en gammes modulaires 600, 700 et 900."],
        ["Fours", "fours", "Fours mixtes et à convection, de 4 à 20 niveaux."],
        ["Tables réfrigérées", "table-refrigeree", "Le froid au poste de travail, avec ou sans dosseret."],
        ["Armoires réfrigérées", "armoire-refrigerees-positives", "Positives et négatives, une à quatre portes."],
        ["Lavage", "lavage", "Lave-verres, lave-vaisselle à capot et plonges."],
        ["Inox neutre", "inox-neutre", "Tables, étagères, armoires murales et chariots."],
      ],
      "cuisson",
      "Fourneaux, fours, tables réfrigérées, lave-vaisselle et inox pour restaurant. Matériel horeca neuf et d'occasion chez HM Froid à Bruxelles.",
    ),
    tradePage(
      "boulangerie-patisserie",
      "Matériel pour boulangerie et pâtisserie",
      "Matériel pour boulangerie et pâtisserie",
      "Vitrines réfrigérées, batteurs, armoires et cellules de refroidissement : le froid et la préparation d'un laboratoire de pâtisserie.",
      "La pâtisserie demande un froid précis et sec, et des cellules capables de descendre vite en température. Nous proposons des armoires pâtissières au format 600 x 400, des cellules de refroidissement rapide et des vitrines qui mettent les produits en valeur sans les dessécher.",
      [
        ["Vitrines réfrigérées", "vitrine", "Vitrines de présentation pour pâtisseries et sandwiches."],
        ["Cellules de refroidissement", "cellule-de-congelation-rapide", "Refroidissement et surgélation rapides."],
        ["Armoires réfrigérées", "armoire-refrigerees-positives", "Positives, négatives, formats pâtissiers."],
        ["Batteurs", "batteur", "De 10 à 60 litres pour les pâtes et les crèmes."],
        ["Vitrines à glace", "vitrine-a-glace", "Pour la glace artisanale en saison."],
        ["Inox neutre", "inox-neutre", "Tables de travail et étagères pour le laboratoire."],
      ],
      "vitrine",
      "Vitrines réfrigérées, cellules de refroidissement, armoires et batteurs pour boulangerie et pâtisserie. Neuf et occasion chez HM Froid.",
    ),
    {
      slug: "marques",
      title: "Marques",
      metaTitle: "Marques distribuées : Bertos, MBM, Robot Coupe, Tefcold",
      metaDescription: "Les fabricants de matériel horeca distribués par HM Froid : Bertos, MBM, Robot Coupe, Tefcold, Hällde, Henkovac, Santos, Wooster et d'autres.",
      doc: {
        root: { props: { title: "Marques" } },
        content: [
          section("RichText", {
            content: [h1("Les marques que nous distribuons"), text("<p>Nous travaillons avec des fabricants pour lesquels nous pouvons fournir des pièces et un suivi. Cliquez sur une marque pour voir ses produits dans le catalogue.</p>", { size: "1", tone: "muted" })],
            align: "start",
            ...chrome({ spacingTop: "xl", spacingBottom: "md" }),
          }),
          section("FeatureGrid", {
            header: { eyebrow: "", title: "", intro: "", align: "start" },
            items: brands.map(([name, blurb]) => ({ icon: "", title: name, text: blurb, link: url(`/search?q=${encodeURIComponent(name)}`) })),
            columns: { base: 1, md: 2, lg: 3 },
            look: "outline",
            iconStyle: "plain",
            ...chrome({ spacingTop: "md", spacingBottom: "2xl" }),
          }),
          contactBand("Une marque que vous ne voyez pas ?", "Nous commandons aussi chez d'autres fabricants européens. Demandez-nous."),
        ],
      },
    },
  ];
}

// ------------------------------------------------------------------ apply ---

function check(label: string, data: DocumentData) {
  const issues = validateDocument(data, registry);
  if (issues.length) {
    console.error(`[${label}]`, issues);
    throw new Error(`${label}: ${issues.length} validation issues`);
  }
  return data;
}

async function writeDocument(scope: Scope, id: string, label: string, data: DocumentData) {
  await forceSaveDraft(scope, { id, data: check(label, data) });
  await publish(scope, { id, label: "HM Froid build" });
  const missing = await translateDocument(scope, id, data);
  console.log(`  published ${label}${missing.length ? ` (${missing.length} strings without Dutch)` : ""}`);
  for (const m of missing) console.warn(`    nl missing: ${JSON.stringify(m)}`);
}

// Brand names and prices read the same in both languages; no row needed.
const sameInDutch = (s: string) => /^[\d\s€.,%-]+$/.test(s) || /^\p{Lu}[\p{L}\d-]*( \p{Lu}[\p{L}\d-]*)?$/u.test(s);

async function translateDocument(scope: Scope, documentId: string, data: DocumentData) {
  const entries: { path: string; value: string; status: "done" }[] = [];
  const missing: string[] = [];
  for (const s of stringsOf(data)) {
    const value = nl[s.value];
    if (value) entries.push({ path: translationPath(s.nodeId, s.path), value, status: "done" });
    else if (!sameInDutch(s.value) && !missing.includes(s.value)) missing.push(s.value);
  }
  if (entries.length) await upsertDocumentTranslations(scope, { documentId, locale: NL, entries });
  return missing;
}

async function translatePage(scope: Scope, pageId: string, slug: string) {
  const t = nlPages[slug];
  if (!t) {
    console.warn(`    no Dutch page fields for /${slug}`);
    return;
  }
  await upsertPageTranslations(scope, { pageId, locale: NL, entries: t });
}

async function ensureDutch(siteId: string) {
  const [row] = await db.select().from(siteLocale).where(and(eq(siteLocale.siteId, siteId), eq(siteLocale.locale, NL))).limit(1);
  if (!row) {
    await db.insert(siteLocale).values({ siteId, locale: NL, isPrimary: false, isPublished: true });
  } else if (!row.isPublished) {
    await db.update(siteLocale).set({ isPublished: true }).where(eq(siteLocale.id, row.id));
  }
  await upsertSiteTranslations({ siteId }, { locale: NL, entries: { metaTitle: "HM Froid, horecamateriaal in Brussel", metaDescription: "Nieuw en tweedehands horecamateriaal in Anderlecht: koeling, kooktoestellen, inox en voorbereiding voor restaurants, frituren, beenhouwerijen en bakkerijen." } });
  console.log(`  ${NL} published`);
}

async function main() {
  const [s] = await db.select().from(site).where(eq(site.slug, SITE_SLUG)).limit(1);
  if (!s) throw new Error(`site ${SITE_SLUG} not found`);
  const scope: Scope = { siteId: s.id };
  console.log(`HM Froid build on ${s.slug} (${s.id})`);
  await ensureDutch(s.id);

  // Kit media (photos, film, mark, partner logos) is uploaded once and reused.
  const userId = process.env.HM_FROID_USER_ID || (await db.select().from(asset).where(eq(asset.organizationId, s.organizationId)).limit(1))[0]?.createdById;
  if (!userId) throw new Error("no uploader: set HM_FROID_USER_ID");
  const kit = await chapterMedia(s.organizationId, s.id, userId);

  // Theme: push the code version into the live theme row, with the kit's grain texture.
  const [t] = await db.select().from(theme).where(and(eq(theme.siteId, s.id), eq(theme.isActive, true))).limit(1);
  if (t) {
    const current = await getTheme(scope, t.id);
    const data = { ...hmFroidTheme, kits: [{ id: "chapters", assets: { "inox-grain": kit.texture } }] };
    await saveThemeDraft(scope, { id: t.id, data, baseVersion: current.draftVersion });
    await publishTheme(scope, { id: t.id, label: "Inox: chrome, white, graphite" });
    console.log(`  published theme ${t.name}`);
  }

  const split = await findMedia(s.organizationId, "cellule-refroidissement");
  if (!split) console.warn("  split image missing from the media library; sections keep an empty media slot");

  // Header and footer.
  const groups = await db.select().from(sectionGroup).where(eq(sectionGroup.siteId, s.id));
  const header = groups.find((g) => g.kind === "header");
  const footer = groups.find((g) => g.kind === "footer");
  if (header) await writeDocument(scope, header.documentId, "header", mastheadDoc(kit));
  if (footer) await writeDocument(scope, footer.documentId, "footer", chapterFooterDoc(kit));

  // Templates.
  const templates = await db.select().from(template).where(eq(template.siteId, s.id));
  const tpl = (kind: string) => templates.find((x) => x.resourceKind === kind && (x.handle === "default" || !x.handle));
  const docs: [string, DocumentData][] = [
    ["home", chapterHomeDoc(kit)],
    ["collection", collectionDoc(false)],
    ["collection_list", collectionDoc(true)],
    ["product", productDoc()],
    ["not_found", notFoundDoc()],
  ];
  for (const [kind, data] of docs) {
    const row = tpl(kind);
    if (!row) {
      console.warn(`  no ${kind} template, skipped`);
      continue;
    }
    await writeDocument(scope, row.documentId, `template ${kind}`, data);
  }

  // Pages: create missing ones, overwrite the ones this script owns.
  const existing = await listPages(scope);
  for (const spec of pages(split)) {
    let row = existing.find((x) => x.slug === spec.slug);
    if (!row) {
      const created = await createPage(scope, { title: spec.title, slug: spec.slug, metaTitle: spec.metaTitle, metaDescription: spec.metaDescription, data: spec.doc });
      row = { ...created } as typeof row;
      console.log(`  created /${spec.slug}`);
    } else {
      await updatePage(scope, row.id, { title: spec.title, metaTitle: spec.metaTitle ?? null, metaDescription: spec.metaDescription });
    }
    await writeDocument(scope, row!.documentId, `page /${spec.slug}`, spec.doc);
    await translatePage(scope, row!.id, spec.slug);
  }

  // Keep /plan-du-site (blueprint) but make sure it is published.
  const plan = existing.find((x) => x.slug === "plan-du-site");
  if (plan) {
    const doc = await getDocument(scope, plan.documentId);
    await writeDocument(scope, plan.documentId, "page /plan-du-site", doc.draft as DocumentData);
    await translatePage(scope, plan.id, plan.slug);
  }

  await notifyRevalidate(s.slug, []).catch((e) => console.warn("  revalidate skipped:", (e as Error).message));
  console.log("done");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
