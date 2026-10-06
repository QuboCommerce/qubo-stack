import { instantiate, type BlockRegistry, type Capability, type DocumentData, type SlotNode } from "../core";
import { registry as defaultRegistry } from "../library";

/**
 * Page blueprints: pages a site is likely to want, suggested by the modules
 * it has switched on. Nothing is forced; a blog never sees "Delivery and
 * payment", a shop sees it until the page exists. Each blueprint knows its
 * title and URL per language and builds a starter document the merchant then
 * edits in the Studio. Starters contain structure and neutral guidance text
 * with [placeholders], never legal claims on the merchant's behalf.
 */

export const blueprintCategories = {
  legal: "Legal",
  commerce: "Shop",
  company: "Company",
  utility: "Utility",
} as const;
export type BlueprintCategory = keyof typeof blueprintCategories;

export const blueprintLocales = ["fr-BE", "nl-BE", "en"] as const;
export type BlueprintLocale = (typeof blueprintLocales)[number];
type Localized = Record<BlueprintLocale, string>;

export type BlueprintContext = {
  locale: BlueprintLocale;
  siteName: string;
  capabilities: readonly Capability[];
  registry?: BlockRegistry;
};

export type PageBlueprint = {
  id: string;
  category: BlueprintCategory;
  /** lucide icon name. */
  icon: string;
  /** Capabilities the page only makes sense with; empty = every site. */
  requires: Capability[];
  /** Why a site would want it (admin copy). */
  description: string;
  title: Localized;
  slug: Localized;
  metaDescription: Localized;
  starter: (ctx: BlueprintContext) => DocumentData;
};

/** Maps a site locale onto the languages blueprints are written in. */
export function blueprintLocale(locale: string): BlueprintLocale {
  const lang = locale.toLowerCase().split(/[-_]/)[0];
  if (lang === "fr") return "fr-BE";
  if (lang === "nl") return "nl-BE";
  return "en";
}

type Article = { title: string; intro: string; sections: [heading: string, body: string][] };

function article(ctx: BlueprintContext, a: Article, extra: SlotNode[] = []): DocumentData {
  const registry = ctx.registry ?? defaultRegistry;
  const content = [
    { type: "Heading", props: { text: a.title, level: "h1", align: "inherit" } },
    { type: "Text", props: { body: `<p>${a.intro}</p>` } },
    ...a.sections.flatMap(([heading, body]) => [
      { type: "Heading", props: { text: heading, level: "h2", align: "inherit" } },
      { type: "Text", props: { body: `<p>${body}</p>` } },
    ]),
  ];
  return {
    root: { props: { title: a.title } },
    content: [instantiate(registry, "RichText", { props: { content, align: "start" } }), ...extra],
  };
}

const pick = <T>(ctx: BlueprintContext, v: Record<BlueprintLocale, T>) => v[ctx.locale];

// ------------------------------------------------------------------ legal ---

const legalNotice: PageBlueprint = {
  id: "legal-notice",
  category: "legal",
  icon: "scale",
  requires: [],
  description: "Who publishes the site: company, registration numbers, hosting. Required for Belgian businesses.",
  title: { "fr-BE": "Mentions légales", "nl-BE": "Wettelijke vermeldingen", en: "Legal notice" },
  slug: { "fr-BE": "mentions-legales", "nl-BE": "wettelijke-vermeldingen", en: "legal-notice" },
  metaDescription: {
    "fr-BE": "Éditeur du site, coordonnées, numéro d'entreprise et hébergement.",
    "nl-BE": "Uitgever van de site, contactgegevens, ondernemingsnummer en hosting.",
    en: "Site publisher, contact details, company number and hosting.",
  },
  starter: (ctx) =>
    article(
      ctx,
      pick(ctx, {
        "fr-BE": {
          title: "Mentions légales",
          intro: `Ce site est édité par ${ctx.siteName}. Vous trouverez ici les informations légales relatives à l'entreprise et au site.`,
          sections: [
            ["Éditeur", "[Dénomination sociale], [forme juridique], [adresse du siège]. Numéro d'entreprise (BCE) : [0000.000.000]. TVA : [BE 0000.000.000]."],
            ["Contact", "Téléphone : [+32 ...]. E-mail : [adresse]."],
            ["Hébergement", "Le site est hébergé par [nom de l'hébergeur], [adresse]."],
            ["Propriété intellectuelle", "Les textes, images et logos de ce site sont protégés. Toute reproduction sans accord écrit est interdite."],
          ],
        },
        "nl-BE": {
          title: "Wettelijke vermeldingen",
          intro: `Deze site wordt uitgegeven door ${ctx.siteName}. Hier vindt u de wettelijke informatie over de onderneming en de site.`,
          sections: [
            ["Uitgever", "[Maatschappelijke naam], [rechtsvorm], [adres maatschappelijke zetel]. Ondernemingsnummer (KBO): [0000.000.000]. Btw: [BE 0000.000.000]."],
            ["Contact", "Telefoon: [+32 ...]. E-mail: [adres]."],
            ["Hosting", "De site wordt gehost door [naam hostingbedrijf], [adres]."],
            ["Intellectuele eigendom", "Teksten, beelden en logo's op deze site zijn beschermd. Reproductie zonder schriftelijke toestemming is niet toegestaan."],
          ],
        },
        en: {
          title: "Legal notice",
          intro: `This site is published by ${ctx.siteName}. The legal information about the company and the site is listed here.`,
          sections: [
            ["Publisher", "[Registered name], [legal form], [registered office]. Company number: [0000.000.000]. VAT: [BE 0000.000.000]."],
            ["Contact", "Phone: [+32 ...]. Email: [address]."],
            ["Hosting", "The site is hosted by [hosting provider], [address]."],
            ["Intellectual property", "Texts, images and logos on this site are protected. Reproduction without written consent is not permitted."],
          ],
        },
      }),
    ),
};

const privacy: PageBlueprint = {
  id: "privacy",
  category: "legal",
  icon: "shield-check",
  requires: [],
  description: "What personal data the site collects, why, for how long, and the visitor's rights under the GDPR.",
  title: { "fr-BE": "Politique de confidentialité", "nl-BE": "Privacybeleid", en: "Privacy policy" },
  slug: { "fr-BE": "politique-de-confidentialite", "nl-BE": "privacybeleid", en: "privacy-policy" },
  metaDescription: {
    "fr-BE": "Quelles données nous collectons, pourquoi, combien de temps, et vos droits.",
    "nl-BE": "Welke gegevens we verzamelen, waarom, hoelang, en uw rechten.",
    en: "What data we collect, why, for how long, and your rights.",
  },
  starter: (ctx) =>
    article(
      ctx,
      pick(ctx, {
        "fr-BE": {
          title: "Politique de confidentialité",
          intro: `${ctx.siteName} traite vos données personnelles avec soin et conformément au RGPD. Cette page explique ce que nous collectons et pourquoi.`,
          sections: [
            ["Responsable du traitement", "[Dénomination sociale], [adresse], [e-mail de contact]."],
            ["Données collectées", "Formulaires de contact, commandes et compte client : nom, coordonnées, historique. Données techniques : adresse IP, pages visitées."],
            ["Finalités et durée", "Répondre à vos demandes, exécuter vos commandes, respecter nos obligations légales. Les données sont conservées [durée] puis supprimées."],
            ["Vos droits", "Vous pouvez demander l'accès, la rectification ou la suppression de vos données à [e-mail]. Vous pouvez introduire une réclamation auprès de l'Autorité de protection des données."],
            ["Cookies", "Le site utilise des cookies techniques nécessaires à son fonctionnement et, avec votre accord, des cookies de mesure d'audience."],
          ],
        },
        "nl-BE": {
          title: "Privacybeleid",
          intro: `${ctx.siteName} gaat zorgvuldig om met uw persoonsgegevens, in lijn met de AVG. Deze pagina legt uit wat we verzamelen en waarom.`,
          sections: [
            ["Verwerkingsverantwoordelijke", "[Maatschappelijke naam], [adres], [contact e-mail]."],
            ["Verzamelde gegevens", "Contactformulieren, bestellingen en klantenaccount: naam, contactgegevens, geschiedenis. Technische gegevens: IP-adres, bezochte pagina's."],
            ["Doeleinden en bewaartermijn", "Uw vragen beantwoorden, uw bestellingen uitvoeren, onze wettelijke verplichtingen nakomen. Gegevens bewaren we [termijn] en verwijderen we daarna."],
            ["Uw rechten", "U kunt inzage, correctie of verwijdering van uw gegevens vragen via [e-mail]. U kunt een klacht indienen bij de Gegevensbeschermingsautoriteit."],
            ["Cookies", "De site gebruikt technische cookies die nodig zijn voor de werking en, met uw toestemming, cookies voor bezoekersstatistieken."],
          ],
        },
        en: {
          title: "Privacy policy",
          intro: `${ctx.siteName} handles your personal data with care and in line with the GDPR. This page explains what we collect and why.`,
          sections: [
            ["Data controller", "[Registered name], [address], [contact email]."],
            ["Data we collect", "Contact forms, orders and customer accounts: name, contact details, history. Technical data: IP address, pages visited."],
            ["Purposes and retention", "Answering your requests, fulfilling orders, meeting legal obligations. Data is kept for [period] and then deleted."],
            ["Your rights", "You may request access, correction or deletion of your data at [email]. You may lodge a complaint with the Data Protection Authority."],
            ["Cookies", "The site uses technical cookies needed to operate and, with your consent, audience measurement cookies."],
          ],
        },
      }),
    ),
};

const terms: PageBlueprint = {
  id: "terms",
  category: "legal",
  icon: "file-text",
  requires: [],
  description: "The rules of the relationship: use of the site and, for shops, orders, prices, delivery and returns.",
  title: { "fr-BE": "Conditions générales", "nl-BE": "Algemene voorwaarden", en: "Terms and conditions" },
  slug: { "fr-BE": "conditions-generales", "nl-BE": "algemene-voorwaarden", en: "terms-and-conditions" },
  metaDescription: {
    "fr-BE": "Conditions d'utilisation du site et conditions de vente.",
    "nl-BE": "Gebruiksvoorwaarden van de site en verkoopsvoorwaarden.",
    en: "Terms of use of the site and terms of sale.",
  },
  starter: (ctx) => {
    const shop = ctx.capabilities.includes("commerce");
    return article(
      ctx,
      pick(ctx, {
        "fr-BE": {
          title: shop ? "Conditions générales de vente" : "Conditions générales",
          intro: `Les présentes conditions régissent l'utilisation du site de ${ctx.siteName}${shop ? " et toute commande passée sur celui-ci" : ""}.`,
          sections: [
            ["Champ d'application", "En utilisant ce site, vous acceptez les présentes conditions. [Dénomination sociale] peut les modifier ; la version en ligne fait foi."],
            ...(shop
              ? ([
                  ["Commandes et prix", "Les prix sont indiqués en euros, [TVA comprise ou hors TVA]. Une commande est ferme à réception de la confirmation."],
                  ["Livraison", "Les délais et frais de livraison sont indiqués sur la page Livraison et paiement."],
                  ["Droit de rétractation", "Les consommateurs disposent de 14 jours pour se rétracter, sauf exceptions légales. [Préciser les modalités de retour]."],
                  ["Garantie", "Les produits bénéficient de la garantie légale. [Préciser les garanties commerciales éventuelles]."],
                ] as [string, string][])
              : []),
            ["Responsabilité", "Les informations du site sont fournies à titre indicatif. [Dénomination sociale] ne peut être tenue responsable des erreurs ou de l'indisponibilité du site."],
            ["Droit applicable", "Le droit belge s'applique. Tout litige relève des tribunaux de [arrondissement]."],
          ],
        },
        "nl-BE": {
          title: shop ? "Algemene verkoopsvoorwaarden" : "Algemene voorwaarden",
          intro: `Deze voorwaarden regelen het gebruik van de site van ${ctx.siteName}${shop ? " en elke bestelling die erop wordt geplaatst" : ""}.`,
          sections: [
            ["Toepassingsgebied", "Door deze site te gebruiken aanvaardt u deze voorwaarden. [Maatschappelijke naam] kan ze wijzigen; de online versie geldt."],
            ...(shop
              ? ([
                  ["Bestellingen en prijzen", "Prijzen zijn in euro, [inclusief of exclusief btw]. Een bestelling is definitief bij ontvangst van de bevestiging."],
                  ["Levering", "Levertermijnen en -kosten staan op de pagina Levering en betaling."],
                  ["Herroepingsrecht", "Consumenten hebben 14 dagen om te herroepen, behoudens wettelijke uitzonderingen. [Retourmodaliteiten vermelden]."],
                  ["Garantie", "Op de producten geldt de wettelijke garantie. [Eventuele commerciële garanties vermelden]."],
                ] as [string, string][])
              : []),
            ["Aansprakelijkheid", "De informatie op de site is indicatief. [Maatschappelijke naam] is niet aansprakelijk voor fouten of onbeschikbaarheid van de site."],
            ["Toepasselijk recht", "Het Belgische recht is van toepassing. Geschillen vallen onder de rechtbanken van [arrondissement]."],
          ],
        },
        en: {
          title: shop ? "Terms of sale" : "Terms and conditions",
          intro: `These terms govern the use of the ${ctx.siteName} website${shop ? " and any order placed on it" : ""}.`,
          sections: [
            ["Scope", "By using this site you accept these terms. [Registered name] may update them; the online version prevails."],
            ...(shop
              ? ([
                  ["Orders and prices", "Prices are in euros, [including or excluding VAT]. An order is binding once the confirmation is sent."],
                  ["Delivery", "Delivery times and costs are listed on the Delivery and payment page."],
                  ["Right of withdrawal", "Consumers have 14 days to withdraw, subject to legal exceptions. [Describe the return procedure]."],
                  ["Warranty", "Products carry the legal warranty. [Describe any commercial warranty]."],
                ] as [string, string][])
              : []),
            ["Liability", "Information on the site is indicative. [Registered name] is not liable for errors or unavailability of the site."],
            ["Governing law", "Belgian law applies. Disputes fall under the courts of [district]."],
          ],
        },
      }),
    );
  },
};

// --------------------------------------------------------------- commerce ---

const deliveryPayment: PageBlueprint = {
  id: "delivery-payment",
  category: "commerce",
  icon: "truck",
  requires: ["commerce"],
  description: "Real delivery zones, costs and lead times, plus the payment methods you accept. One page: paying and receiving go together.",
  title: { "fr-BE": "Livraison et paiement", "nl-BE": "Levering en betaling", en: "Delivery and payment" },
  slug: { "fr-BE": "livraison-et-paiement", "nl-BE": "levering-en-betaling", en: "delivery-and-payment" },
  metaDescription: {
    "fr-BE": "Zones de livraison, délais, frais, retrait sur place et moyens de paiement acceptés.",
    "nl-BE": "Leveringszones, termijnen, kosten, afhaling ter plaatse en aanvaarde betaalmethodes.",
    en: "Delivery areas, lead times, costs, pickup and accepted payment methods.",
  },
  starter: (ctx) =>
    article(
      ctx,
      pick(ctx, {
        "fr-BE": {
          title: "Livraison et paiement",
          intro: "Ce que vous payez, comment, et quand vous recevez votre commande.",
          sections: [
            ["Zones et délais", "Nous livrons en [zone]. Délai habituel : [x à y jours ouvrables] après confirmation."],
            ["Frais de livraison", "[Tarif ou grille]. Livraison offerte à partir de [montant]."],
            ["Retrait sur place", "Vous pouvez retirer votre commande à [adresse], [horaires]."],
            ["Moyens de paiement", "[Bancontact, Visa, Mastercard, virement, ...]. Le paiement est sécurisé."],
          ],
        },
        "nl-BE": {
          title: "Levering en betaling",
          intro: "Wat u betaalt, hoe, en wanneer u uw bestelling ontvangt.",
          sections: [
            ["Zones en termijnen", "We leveren in [zone]. Gebruikelijke termijn: [x tot y werkdagen] na bevestiging."],
            ["Leveringskosten", "[Tarief of tabel]. Gratis levering vanaf [bedrag]."],
            ["Afhalen", "U kunt uw bestelling afhalen op [adres], [openingsuren]."],
            ["Betaalmethodes", "[Bancontact, Visa, Mastercard, overschrijving, ...]. Betalen gebeurt beveiligd."],
          ],
        },
        en: {
          title: "Delivery and payment",
          intro: "What you pay, how, and when your order arrives.",
          sections: [
            ["Areas and lead times", "We deliver to [area]. Usual lead time: [x to y working days] after confirmation."],
            ["Delivery costs", "[Rate or table]. Free delivery from [amount]."],
            ["Pickup", "You can collect your order at [address], [opening hours]."],
            ["Payment methods", "[Bancontact, Visa, Mastercard, bank transfer, ...]. Payments are secured."],
          ],
        },
      }),
    ),
};

const warranty: PageBlueprint = {
  id: "warranty-service",
  category: "commerce",
  icon: "wrench",
  requires: ["commerce"],
  description: "Warranty terms and how after-sales service works: who to call, what to send, typical turnaround.",
  title: { "fr-BE": "Garantie et SAV", "nl-BE": "Garantie en service", en: "Warranty and service" },
  slug: { "fr-BE": "garantie-et-sav", "nl-BE": "garantie-en-service", en: "warranty-and-service" },
  metaDescription: {
    "fr-BE": "Durée de garantie, démarches en cas de panne et service après-vente.",
    "nl-BE": "Garantieduur, wat te doen bij een defect en dienst na verkoop.",
    en: "Warranty period, what to do when something fails and after-sales service.",
  },
  starter: (ctx) =>
    article(
      ctx,
      pick(ctx, {
        "fr-BE": {
          title: "Garantie et service après-vente",
          intro: "Un produit qui tombe en panne doit repartir vite. Voici comment nous procédons.",
          sections: [
            ["Garantie", "Nos produits sont couverts [durée] à compter de la livraison, pièces [et main-d'œuvre]. La garantie légale s'applique aux consommateurs."],
            ["En cas de panne", "Contactez-nous au [téléphone] ou à [e-mail] avec votre numéro de commande et une description du problème."],
            ["Délais", "Diagnostic sous [délai]. Réparation ou remplacement selon le cas."],
          ],
        },
        "nl-BE": {
          title: "Garantie en dienst na verkoop",
          intro: "Een toestel dat uitvalt moet snel weer draaien. Zo pakken we dat aan.",
          sections: [
            ["Garantie", "Onze producten zijn [duur] gedekt vanaf levering, onderdelen [en werkuren]. Voor consumenten geldt de wettelijke garantie."],
            ["Bij een defect", "Contacteer ons op [telefoon] of via [e-mail] met uw bestelnummer en een beschrijving van het probleem."],
            ["Termijnen", "Diagnose binnen [termijn]. Herstelling of vervanging naargelang het geval."],
          ],
        },
        en: {
          title: "Warranty and after-sales service",
          intro: "When something fails it should be back in service quickly. This is how we handle it.",
          sections: [
            ["Warranty", "Our products are covered for [period] from delivery, parts [and labour]. The legal warranty applies to consumers."],
            ["When something fails", "Contact us at [phone] or [email] with your order number and a description of the problem."],
            ["Turnaround", "Diagnosis within [period]. Repair or replacement depending on the case."],
          ],
        },
      }),
    ),
};

// ---------------------------------------------------------------- company ---

const about: PageBlueprint = {
  id: "about",
  category: "company",
  icon: "building-2",
  requires: [],
  description: "Who you are, since when, for whom. The page people read before they trust you.",
  title: { "fr-BE": "Qui sommes-nous", "nl-BE": "Over ons", en: "About us" },
  slug: { "fr-BE": "qui-sommes-nous", "nl-BE": "over-ons", en: "about-us" },
  metaDescription: {
    "fr-BE": "L'histoire, l'équipe et la façon de travailler de l'entreprise.",
    "nl-BE": "Het verhaal, het team en de manier van werken van het bedrijf.",
    en: "The story, the team and the way the company works.",
  },
  starter: (ctx) =>
    article(
      ctx,
      pick(ctx, {
        "fr-BE": {
          title: "Qui sommes-nous",
          intro: `${ctx.siteName} en quelques lignes : ce que nous faisons, depuis quand, et pour qui.`,
          sections: [
            ["Notre histoire", "[Année de création, fondateur, étapes marquantes.]"],
            ["Ce que nous faisons", "[Produits ou services, clientèle, zone d'activité.]"],
            ["Notre façon de travailler", "[Ce qui vous distingue : conseil, réactivité, stock, savoir-faire.]"],
          ],
        },
        "nl-BE": {
          title: "Over ons",
          intro: `${ctx.siteName} in enkele regels: wat we doen, sinds wanneer, en voor wie.`,
          sections: [
            ["Ons verhaal", "[Oprichtingsjaar, oprichter, mijlpalen.]"],
            ["Wat we doen", "[Producten of diensten, klanten, werkgebied.]"],
            ["Onze manier van werken", "[Wat u onderscheidt: advies, snelheid, voorraad, vakkennis.]"],
          ],
        },
        en: {
          title: "About us",
          intro: `${ctx.siteName} in a few lines: what we do, since when, and for whom.`,
          sections: [
            ["Our story", "[Founding year, founder, milestones.]"],
            ["What we do", "[Products or services, customers, area served.]"],
            ["How we work", "[What sets you apart: advice, speed, stock, know-how.]"],
          ],
        },
      }),
    ),
};

const contact: PageBlueprint = {
  id: "contact",
  category: "company",
  icon: "map-pin",
  requires: [],
  description: "Address, hours, map and a way to reach you. With the Leads module the page carries a contact form.",
  title: { "fr-BE": "Contact", "nl-BE": "Contact", en: "Contact" },
  slug: { "fr-BE": "contact", "nl-BE": "contact", en: "contact" },
  metaDescription: {
    "fr-BE": "Adresse, horaires, plan d'accès et formulaire de contact.",
    "nl-BE": "Adres, openingsuren, routebeschrijving en contactformulier.",
    en: "Address, opening hours, directions and contact form.",
  },
  starter: (ctx) => {
    const registry = ctx.registry ?? defaultRegistry;
    const t = pick(ctx, {
      "fr-BE": { title: "Contact", intro: "Une question, un devis, une visite ? Voici comment nous joindre.", form: "Écrivez-nous", map: "Nous trouver", directions: "Itinéraire" },
      "nl-BE": { title: "Contact", intro: "Een vraag, een offerte, een bezoek? Zo bereikt u ons.", form: "Schrijf ons", map: "Waar vindt u ons", directions: "Routebeschrijving" },
      en: { title: "Contact", intro: "A question, a quote, a visit? Here is how to reach us.", form: "Write to us", map: "Find us", directions: "Get directions" },
    });
    const content: SlotNode[] = [
      instantiate(registry, "RichText", {
        props: {
          align: "start",
          content: [
            { type: "Heading", props: { text: t.title, level: "h1", align: "inherit" } },
            { type: "Text", props: { body: `<p>${t.intro}</p>` } },
          ],
        },
      }),
    ];
    if (ctx.capabilities.includes("leads")) content.push(instantiate(registry, "ContactForm", { props: { header: { title: t.form } } }));
    content.push(instantiate(registry, "Map", { props: { header: { title: t.map }, directionsLabel: t.directions } }));
    return { root: { props: { title: t.title } }, content };
  },
};

// ---------------------------------------------------------------- utility ---

const siteMap: PageBlueprint = {
  id: "sitemap",
  category: "utility",
  icon: "network",
  requires: [],
  description: "Every page and collection as one readable tree, built from the site itself so it never goes stale.",
  title: { "fr-BE": "Plan du site", "nl-BE": "Sitemap", en: "Site map" },
  slug: { "fr-BE": "plan-du-site", "nl-BE": "sitemap", en: "site-map" },
  metaDescription: {
    "fr-BE": "Toutes les pages et catégories du site en un coup d'œil.",
    "nl-BE": "Alle pagina's en categorieën van de site in één oogopslag.",
    en: "Every page and category of the site at a glance.",
  },
  starter: (ctx) => {
    const registry = ctx.registry ?? defaultRegistry;
    const t = pick(ctx, {
      "fr-BE": { title: "Plan du site", intro: "Toutes les pages du site, pour s'y retrouver.", pages: "Pages", collections: "Catégories" },
      "nl-BE": { title: "Sitemap", intro: "Alle pagina's van de site op een rij.", pages: "Pagina's", collections: "Categorieën" },
      en: { title: "Site map", intro: "Every page of the site, in one place.", pages: "Pages", collections: "Collections" },
    });
    return {
      root: { props: { title: t.title } },
      content: [
        instantiate(registry, "SiteTree", {
          props: { header: { title: t.title, intro: t.intro, align: "start" }, pagesLabel: t.pages, collectionsLabel: t.collections },
        }),
      ],
    };
  },
};

const faq: PageBlueprint = {
  id: "faq",
  category: "utility",
  icon: "circle-help",
  requires: [],
  description: "The questions you answer on the phone every week, written once. Emits FAQ rich results for search engines.",
  title: { "fr-BE": "Questions fréquentes", "nl-BE": "Veelgestelde vragen", en: "FAQ" },
  slug: { "fr-BE": "questions-frequentes", "nl-BE": "veelgestelde-vragen", en: "faq" },
  metaDescription: {
    "fr-BE": "Réponses aux questions les plus fréquentes de nos clients.",
    "nl-BE": "Antwoorden op de vragen die onze klanten het vaakst stellen.",
    en: "Answers to the questions our customers ask most.",
  },
  starter: (ctx) => {
    const registry = ctx.registry ?? defaultRegistry;
    const t = pick(ctx, {
      "fr-BE": { title: "Questions fréquentes", intro: "Les réponses aux questions que l'on nous pose le plus souvent.", q: "Votre question ?", a: "Une réponse claire et courte." },
      "nl-BE": { title: "Veelgestelde vragen", intro: "Antwoorden op wat ons het vaakst wordt gevraagd.", q: "Uw vraag?", a: "Een kort en duidelijk antwoord." },
      en: { title: "FAQ", intro: "Answers to what we get asked most often.", q: "Your question?", a: "A clear, short answer." },
    });
    return {
      root: { props: { title: t.title } },
      content: [
        instantiate(registry, "Faq", {
          props: {
            header: { title: t.title, intro: t.intro, align: "start" },
            items: [1, 2, 3].map(() => ({ question: t.q, answer: t.a })),
          },
        }),
      ],
    };
  },
};

export const pageBlueprints: readonly PageBlueprint[] = [legalNotice, privacy, terms, deliveryPayment, warranty, about, contact, siteMap, faq];

export const pageBlueprint = (id: string) => pageBlueprints.find((b) => b.id === id);

export type BlueprintSuggestion = {
  blueprint: PageBlueprint;
  title: string;
  slug: string;
  /** Capabilities the site lacks; non-empty means "needs the X module". */
  missing: Capability[];
  /** A page with this slug already exists. */
  exists: boolean;
};

/**
 * Blueprints for a site, in registry order. Each carries its localized title
 * and slug, whether its modules are on, and whether the page already exists
 * (matched on slug, the only identity a page has).
 */
export function suggestPages(input: { locale: string; capabilities: readonly Capability[]; existingSlugs: readonly string[] }): BlueprintSuggestion[] {
  const locale = blueprintLocale(input.locale);
  const have = new Set(input.capabilities);
  const taken = new Set(input.existingSlugs);
  return pageBlueprints.map((blueprint) => {
    const slug = blueprint.slug[locale];
    return {
      blueprint,
      title: blueprint.title[locale],
      slug,
      missing: blueprint.requires.filter((c) => !have.has(c)),
      exists: taken.has(slug),
    };
  });
}
