import { instantiate, setPath, walkFields, type BlockRegistry, type DocumentData, type MediaValue, type SlotNode } from "../core";
import { registry as defaultRegistry } from "../library";

const n = (type: string, props: Record<string, unknown> = {}): SlotNode => ({ type, props });

/**
 * HM Froid home page rebuilt from library blocks — the render proof and a
 * realistic fixture for tests, the inspector and AI examples.
 */
export function hmFroidHomeFixture(registry = defaultRegistry): DocumentData {
  const make = (type: string, props: Record<string, unknown> = {}) => instantiate(registry, type, { props });

  return {
    root: { props: { title: "HM Froid — Réfrigération professionnelle" } },
    content: [
      make("AnnouncementBar", {
        messages: [{ text: "Dépannage 24/7 en Belgique — appelez le +32 2 000 00 00", link: { kind: "phone", value: "+3220000000" } }],
        icon: "phone",
        section: { scheme: "polar-night" },
      }),
      make("Hero", {
        layout: "split",
        media: { url: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1600&q=70", alt: "Technicien HM Froid" },
        content: [
          n("Eyebrow", { text: "Depuis 2006", look: "pill", icon: "snowflake" }),
          n("Heading", {
            text: "Le froid professionnel, installé et entretenu",
            decor: { preset: "squiggle", match: "froid professionnel", ranges: [] },
            level: "h1",
            size: "6",
            font: "display",
          }),
          n("Text", {
            body: "<p>Chambres froides, vitrines réfrigérées et équipements de froid commercial : vente, installation et maintenance partout en Belgique.</p>",
            size: "1",
            tone: "muted",
          }),
          n("ButtonGroup", {
            buttons: [
              n("Button", { label: "Demander un devis", link: { kind: "page", value: "contact" }, icon: "arrow-right" }),
              n("Button", { label: "Voir le catalogue", emphasis: "outline", link: { kind: "collection", value: "all" } }),
            ],
          }),
        ],
        section: { scheme: "ice", edges: { bottom: "angle" } },
      }),
      make("StatsBand", {
        items: [
          { value: "18+", label: "Années d'expérience" },
          { value: "2 400", label: "Installations" },
          { value: "24/7", label: "Service d'urgence" },
        ],
        section: { spacingTop: "2xl", spacingBottom: "lg" },
      }),
      make("FeatureGrid", {
        header: { eyebrow: "Nos services", title: "Du conseil à la maintenance", align: "center" },
        items: [
          { icon: "snowflake", title: "Chambres froides", text: "Conception sur mesure, positives et négatives." },
          { icon: "thermometer", title: "Vitrines réfrigérées", text: "Boulangeries, boucheries, traiteurs, horeca." },
          { icon: "wrench", title: "Installation", text: "Techniciens certifiés, mise en service rapide." },
          { icon: "shield-check", title: "Contrats d'entretien", text: "Contrôles F-Gas et maintenance préventive." },
          { icon: "clock", title: "Dépannage 24/7", text: "Intervention d'urgence en Belgique." },
          { icon: "recycle", title: "Reprise & recyclage", text: "Évacuation conforme de vos anciens équipements." },
        ],
        look: "card",
      }),
      make("ProductGrid", {
        header: { title: "Équipements en vedette", align: "start", cta: { label: "Tout voir", link: { kind: "collection", value: "all" } } },
        limit: 4,
        columns: { base: 2, md: 2, lg: 4 },
      }),
      make("SplitMedia", {
        media: { url: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=1400&q=70", alt: "Atelier" },
        content: [
          n("Eyebrow", { text: "Notre atelier" }),
          n("Heading", { text: "Une équipe familiale, un savoir-faire industriel" }),
          n("Text", {
            body: "<p>Mostapha Hilal a fondé HM Froid avec une idée simple : un seul interlocuteur, du devis à l'entretien.</p>",
            tone: "muted",
          }),
          n("List", {
            items: [{ text: "Techniciens certifiés F-Gas" }, { text: "Pièces détachées en stock" }, { text: "Devis gratuit sous 24 h" }],
          }),
        ],
        mediaPosition: "end",
        section: { scheme: "frosted" },
      }),
      make("Process", {
        header: { title: "Comment ça marche", align: "center" },
        steps: [
          { title: "Visite technique", text: "Nous mesurons et évaluons vos besoins sur place." },
          { title: "Devis détaillé", text: "Une offre claire, sans surprise." },
          { title: "Installation", text: "Mise en service et formation de votre équipe." },
          { title: "Suivi", text: "Entretien préventif et dépannage prioritaire." },
        ],
      }),
      make("Testimonials", {
        header: { title: "Ils nous font confiance" },
        items: [
          { quote: "Chambre froide installée en deux jours, sans interruption de service.", author: "Karim B.", role: "Boucherie, Anderlecht", rating: 5 },
          { quote: "Réactifs et professionnels, même un dimanche soir.", author: "Sophie D.", role: "Restaurant, Ixelles", rating: 5 },
          { quote: "Un contrat d'entretien qui nous évite les mauvaises surprises.", author: "Luc V.", role: "Supermarché, Namur", rating: 5 },
        ],
      }),
      make("Faq", {
        header: { title: "Questions fréquentes" },
        items: [
          { question: "Intervenez-vous partout en Belgique ?", answer: "Oui, avec des délais garantis à Bruxelles et en Wallonie." },
          { question: "Proposez-vous la location ?", answer: "Oui, pour les vitrines et chambres froides mobiles." },
          { question: "Combien coûte un devis ?", answer: "Le devis est gratuit et sans engagement." },
        ],
        layout: "side",
      }),
      make("CtaBand", {
        content: [
          n("Heading", { text: "Un projet de froid ? Parlons-en.", size: "4", align: "center" }),
          n("Text", { body: "<p>Réponse sous 24 heures ouvrables.</p>", tone: "muted", align: "center" }),
          n("ButtonGroup", {
            align: "center",
            buttons: [n("Button", { label: "Demander un devis", link: { kind: "page", value: "contact" } })],
          }),
        ],
        panel: "polar-night",
      }),
      make("ContactForm", {
        header: { title: "Contact", intro: "Décrivez votre projet, nous revenons vers vous rapidement.", align: "start" },
        fields: [
          { label: "Nom", name: "name", required: true, width: "half" },
          { label: "E-mail", name: "email", type: "email", required: true, width: "half" },
          { label: "Téléphone", name: "phone", type: "tel", width: "half" },
          { label: "Type de projet", name: "project", type: "select", options: "Chambre froide\nVitrine\nEntretien\nDépannage", width: "half" },
          { label: "Message", name: "message", type: "textarea", required: true },
        ],
        submitLabel: "Envoyer",
        details: { phone: "+32 2 000 00 00", email: "info@hmfroid.be", address: "Bruxelles, Belgique", hours: "Lun–Ven 8h–18h\nUrgences 24/7" },
      }),
    ],
  };
}

/** Sample product cards for ProductGrid data binding in fixtures. */
export const sampleProducts = [
  { title: "Chambre froide positive 2×2 m", href: "/products/chambre-froide-2x2", price: "€ 6 490" },
  { title: "Vitrine réfrigérée 1,5 m", href: "/products/vitrine-150", price: "€ 3 250", badge: "Nouveau" },
  { title: "Groupe frigorifique 1,5 CV", href: "/products/groupe-15cv", price: "€ 1 890" },
  { title: "Armoire négative 700 L", href: "/products/armoire-700", price: "€ 2 140", compareAt: "€ 2 390" },
];

/** Neutral, brand-agnostic photos used to fill empty image fields in previews. */
export const sampleImages = [
  "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1400&q=70",
  "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1400&q=70",
  "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1400&q=70",
  "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=1400&q=70",
  "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1400&q=70",
  "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1400&q=70",
];

/**
 * Fills empty image fields (recursively through slots) with sample photos so
 * library thumbnails show what a section looks like with real content.
 * Section chrome (background media) is left alone.
 */
export function withSampleMedia(node: SlotNode, registry: BlockRegistry = defaultRegistry): SlotNode {
  let i = 0;
  const fill = (n: SlotNode): SlotNode => {
    const def = registry.get(n.type);
    if (!def) return n;
    let props = n.props;
    walkFields(def.fields, n.props, (field, value, path) => {
      if (path === "section" || path.startsWith("section.")) return;
      if (field.kind === "media" && field.accept !== "video") {
        const v = value as MediaValue | null | undefined;
        if (!v?.url && !v?.assetId) props = setPath(props, path, { url: sampleImages[i++ % sampleImages.length], alt: "" } satisfies MediaValue);
      } else if (field.kind === "slot" && Array.isArray(value)) {
        props = setPath(props, path, (value as SlotNode[]).map(fill));
      }
    });
    return { ...n, props };
  };
  return fill(node);
}
