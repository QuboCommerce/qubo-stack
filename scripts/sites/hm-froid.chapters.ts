/**
 * HM Froid "Cobalt Chapters" home, header and footer, built from the
 * `chapters` section kit. Copy is the French master; Dutch rows come from
 * `hm-froid.nl.ts` like the rest of the site.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@qubo/db/client";
import { asset } from "@qubo/db/schema";
import { instantiate, registry, type DocumentData, type SlotNode } from "@qubo/blocks";
import { mediaUrl } from "@qubo/storage";
import { uploadAsset } from "@qubo/storage/media";

type Props = Record<string, unknown>;
type Link = { kind: "url" | "page" | "collection" | "anchor" | "email" | "phone"; value: string };
export type Media = { assetId: string; url: string; alt: string; width?: number; height?: number };

const PHONE = "+32 2 411 80 02";
const HOURS = "Lun–Ven 9h–18h · Sam 10h–16h";
const MAPS = "https://www.google.com/maps/search/?api=1&query=Avenue%20Raymond%20Vanderbruggen%2018-20%2C%201070%20Anderlecht";

const col = (handle: string): Link => ({ kind: "collection", value: handle });
const pg = (slug: string): Link => ({ kind: "page", value: slug });
const anchor = (id: string): Link => ({ kind: "anchor", value: id });
/** A home anchor that also works from every other page (header and footer are site wide). */
const home = (id: string): Link => ({ kind: "url", value: `/#${id}` });
const phone: Link = { kind: "phone", value: "+3224118002" };
const action = (label: string, link: Link) => ({ label, link });

const section = (type: string, props: Props, anchorId = ""): SlotNode =>
  instantiate(registry, type, { props: { ...props, section: { width: "full", spacingTop: "none", spacingBottom: "none", entrance: "none", anchorId } } });

// ------------------------------------------------------------------ media ---

const REF = join(import.meta.dir, "../../../ref-material/manus-landingpage/HM-Froid-I11-Source/hmfroid/public/assets");

/** Library filename (SEO friendly), source path under the Manus assets, alt text. */
const files = {
  cold: ["hm-froid-armoire-refrigeree-professionnelle.webp", "images/hmfroid-image-2.webp", "Armoire réfrigérée professionnelle dans un environnement horeca"],
  cooking: ["hm-froid-ligne-cuisson-inox.webp", "images/hmfroid-image-3.webp", "Ligne de cuisson professionnelle en acier inoxydable, prête pour le service"],
  prep: ["hm-froid-plan-travail-inox-preparation.webp", "images/hmfroid-image-4.webp", "Plan de travail inox et matériel de préparation dans une cuisine professionnelle"],
  used: ["hm-froid-materiel-horeca-occasion.webp", "images/hmfroid-image-5.webp", "Équipements horeca d’occasion présentés dans un espace professionnel"],
  texture: ["hm-froid-texture-inox-brosse.webp", "images/hmfroid-inox-texture.webp", ""],
  poster: ["hm-froid-inox-vapeur-froide.jpg", "images/menu-vapor-poster.jpg", "Plaque d’inox sous une lumière bleue et un voile de vapeur froide"],
  film: ["hm-froid-inox-vapeur-froide.mp4", "media/menu-vapor-loop.mp4", "Plaque d’inox sous une lumière bleue et un voile de vapeur froide"],
  mark: ["hm-froid-symbole.svg", "hm-froid-mark.svg", "HM Froid"],
} as const;

type PartnerManifest = { name: string; file: string }[];

export type ChapterMedia = Record<keyof typeof files, Media> & { partners: { name: string; logo: Media }[] };

async function ensure(orgId: string, siteId: string, userId: string, filename: string, source: string, alt: string): Promise<Media> {
  const rows = await db.select().from(asset).where(eq(asset.organizationId, orgId));
  let row = rows.find((r) => r.filename === filename);
  if (!row) {
    const bytes = new Uint8Array(await readFile(join(REF, source)));
    const res = await uploadAsset({ orgId, siteId, userId, filename, bytes, alt });
    if (!res.ok) throw new Error(`upload ${filename}: ${res.error}`);
    console.log(`  uploaded ${filename}`);
    [row] = await db.select().from(asset).where(eq(asset.id, res.item.id));
  }
  const ext = row!.filename.split(".").pop() || "webp";
  return { assetId: row!.id, url: mediaUrl(orgId, row!.id, ext), alt: row!.alt || alt, ...(row!.width ? { width: row!.width } : {}), ...(row!.height ? { height: row!.height } : {}) };
}

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Uploads the kit's photos, film, mark and partner cutouts once; later runs reuse them. */
export async function chapterMedia(orgId: string, siteId: string, userId: string): Promise<ChapterMedia> {
  const out = {} as ChapterMedia;
  for (const [key, [filename, source, alt]] of Object.entries(files)) {
    (out as Record<string, Media>)[key] = await ensure(orgId, siteId, userId, filename, source, alt);
  }
  const manifest = JSON.parse(await readFile(join(REF, "partners/cutouts/manifest.json"), "utf8")) as PartnerManifest;
  out.partners = [];
  for (const p of manifest) {
    const ext = p.file.split(".").pop();
    out.partners.push({ name: p.name, logo: await ensure(orgId, siteId, userId, `partenaire-${slug(p.name)}.${ext}`, `partners/cutouts/${p.file}`, `Logo ${p.name}`) });
  }
  return out;
}

const brand = (m: ChapterMedia) => ({ logo: { ...m.mark, alt: "" }, name: "HM Froid", tagline: "Matériel horeca · Anderlecht" });

// ----------------------------------------------------------------- header ---

const families: { name: string; icon: string; summary: string; link: Link; links: [string, string][] }[] = [
  {
    name: "Froid commercial",
    icon: "line-snow",
    summary: "Le froid professionnel, selon votre activité.",
    link: col("froid-commercial"),
    links: [
      ["Armoires réfrigérées négatives", "armoires-refrigerees-negatives"],
      ["Armoires réfrigérées positives", "armoire-refrigerees-positives"],
      ["Tables réfrigérées", "table-refrigeree"],
      ["Vitrines réfrigérées", "vitrine"],
      ["Comptoirs réfrigérés", "comptoirs-refrigeres"],
      ["Chambres froides", "chambres-froides"],
      ["Machines à glaçons", "machine-a-glacons"],
      ["Congélateurs bahuts", "congelateur-bahut"],
      ["Cellules de refroidissement", "cellule-de-congelation-rapide"],
      ["Arrières de bar", "arrieres-de-bar"],
      ["Caves à vin", "caves-a-vin"],
    ],
  },
  {
    name: "Cuisson",
    icon: "line-flame",
    summary: "Les postes de cuisson et les gammes modulaires.",
    link: col("cuisson"),
    links: [
      ["Gamme MBM Minima 600", "gamme-mbm-minima-600"],
      ["Gamme MBM Domina 700", "gamme-mbm-domina-700"],
      ["Gamme MBM Domina 900", "gamme-mbm-domina-900"],
      ["Friteuses", "friteuse"],
      ["Plaques à snacker", "plaque-a-snacker"],
      ["Salamandres", "salamandre"],
      ["Bains-marie", "cuisson-bain-marie"],
      ["Crêpières et gaufriers", "crepiere"],
      ["Marmites et sauteuses", "marmite"],
    ],
  },
  {
    name: "Inox neutre",
    icon: "line-steel-panel",
    summary: "Surfaces de travail et équipements inox.",
    link: col("inox-neutre"),
    links: [
      ["Tables", "tables"],
      ["Plonges", "plonge"],
      ["Armoires murales", "armoire-mural"],
      ["Étagères", "etagere-mural"],
      ["Chariots", "inox-neutre-chariot"],
      ["Armoires chauffantes", "armoire-chauffante"],
    ],
  },
  {
    name: "Préparation",
    icon: "line-whisk",
    summary: "Les outils qui préparent le service.",
    link: col("preparation"),
    links: [
      ["Trancheuses", "trancheuse"],
      ["Hachoirs", "hachoir"],
      ["Coupe-légumes", "coupe-legumes"],
      ["Cutters", "cutter-professionnel-gargano"],
      ["Robot-Coupe", "robot-coupe"],
      ["Sous-videuses", "sous-videuse"],
      ["Batteurs", "batteur"],
      ["Scies à os", "scie-a-os"],
    ],
  },
  {
    name: "Autres rayons",
    icon: "line-tools",
    summary: "Lavage, ventilation, bar et équipements spécialisés.",
    link: col("all"),
    links: [
      ["Fours", "fours"],
      ["Ventilation", "ventilation"],
      ["Lavage", "lavage"],
      ["Cafétéria et bar", "cafeteria-bar"],
      ["Pizzeria et pasta", "pizzeria-pasta"],
      ["Grills et toasters", "grill-toaster"],
      ["Rôtissoires et gyros", "rotissoire-gyros"],
      ["Balances", "balances"],
      ["Déstockage", "destockage"],
    ],
  },
];

export function mastheadDoc(m: ChapterMedia): DocumentData {
  return {
    root: { props: {} },
    content: [
      section("ChapterMasthead", {
        skipLabel: "Aller au contenu",
        skipTarget: "accueil",
        utility: { place: "Anderlecht, Bruxelles", since: "Depuis 2008", hours: HOURS, phone: PHONE },
        brand: brand(m),
        home: pg("home"),
        browseLabel: "Explorer les rayons",
        mobileLabel: "Menu",
        links: [action("Occasions & rachat", home("occasions")), action("Par métier", home("metiers")), action("Showroom", home("showroom"))],
        contact: action("Nous contacter", home("contact")),
        menu: {
          title: "Les rayons",
          close: "Fermer",
          hookQuestion: "Un projet\u00a0?",
          hookAnswer: "La solution",
          hookBrand: "HM Froid.",
          intro: "Le matériel qui vous convient.\nOn vous aide à le trouver.",
          quote: "HM Froid, C’est *Le* Catalogue Professionnel.",
          video: m.film,
          poster: m.poster,
          tabletLinks: [action("Occasions & rachat", home("occasions")), action("Par métier", home("metiers")), action("Showroom", home("showroom"))],
          quickLinks: [action("Par métier", home("metiers")), action("Le showroom", home("showroom")), action("Parler à HM Froid", home("contact"))],
          allLabel: "Parcourir tout le catalogue",
          allLink: col("all"),
          callQuestion: "Besoin d’un conseil\u00a0?",
          familyLabel: "Voir tout le rayon",
          countLabel: "sous-catégories",
          familiesLabel: "Familles de produits",
        },
        families: [
          ...families.map((f) => ({ name: f.name, icon: f.icon, summary: f.summary, link: f.link, links: f.links.map(([label, handle]) => action(label, col(handle))) })),
          {
            name: "Occasions et rachat",
            icon: "line-cycle",
            summary: "Matériel de seconde main, déstockage et reprise.",
            link: pg("materiel-horeca-occasion"),
            links: [action("Matériel d’occasion", pg("materiel-horeca-occasion")), action("Déstockage", col("destockage")), action("Rachat de votre matériel", pg("rachat-materiel-horeca"))],
          },
        ],
        partnersLabel: "NOS PARTENAIRES",
        partnersShow: "Afficher nos partenaires",
        partnersHide: "Replier nos partenaires",
        partners: m.partners,
      }),
    ],
  };
}

// ------------------------------------------------------------------- home ---

export function chapterHomeDoc(m: ChapterMedia): DocumentData {
  return {
    root: { props: { title: "HM Froid, matériel horeca neuf et d’occasion à Bruxelles" } },
    content: [
      section(
        "ChapterHero",
        {
          heading: "Du bon\nmatériel.\n*Pour un service\n[qui tourne.]*",
          intro: "Un poste à remplacer, une cuisine à équiper\u00a0? Trouvez le matériel qui convient à votre activité, à votre espace et à votre budget. Comparez le neuf et l’occasion, puis échangez avec HM Froid avant de choisir.",
          conditionsLabel: "Matériel neuf et d’occasion",
          conditions: [
            { icon: "line-box-check", label: "Neuf" },
            { icon: "line-cycle", label: "D’occasion" },
          ],
          primary: action("Parcourir le catalogue", col("all")),
          secondary: action("Parler de mon besoin", phone),
          carousel: { label: "Aperçu du matériel HM Froid", place: "HM Froid · Anderlecht", slideLabel: "{n} sur {total}", dotsLabel: "Choisir une image ou un film", prevLabel: "Élément précédent", nextLabel: "Élément suivant" },
          slides: [
            { media: m.cooking, poster: { alt: "" }, caption: "Cuisson, du poste au service", dotLabel: "Afficher la ligne de cuisson" },
            { media: m.prep, poster: { alt: "" }, caption: "L’inox au travail", dotLabel: "Afficher la préparation inox" },
            { media: m.used, poster: { alt: "" }, caption: "Une seconde vie, un nouvel usage", dotLabel: "Afficher les équipements d’occasion" },
            { media: m.film, poster: m.poster, caption: "L’inox, la lumière et la vapeur froide", dotLabel: "Voir le film inox et vapeur froide" },
          ],
        },
        "accueil",
      ),
      section("ChapterProofline", {
        label: "Des repères concrets pour votre choix",
        items: [
          { title: "À Anderlecht depuis 2008", text: "Un showroom au cœur de Bruxelles" },
          { title: "Neuf & occasion", text: "Deux façons de trouver le bon équipement" },
          { title: "Plus de 3\u00a0900 produits", text: "Pour les professionnels de l’Horeca" },
        ],
      }),
      section(
        "ChapterPressure",
        {
          eyebrow: "Les contraintes du terrain",
          eyebrowIcon: "line-worktable",
          heading: "Quand le matériel\n*freine le service.*",
          copy: "Une dimension oubliée, une capacité mal adaptée, un budget engagé au mauvais endroit. Le choix se fait une fois. Ses conséquences se retrouvent à chaque service.",
          items: [
            { icon: "line-worktable", title: "La place est déjà comptée.", text: "Un poste trop encombrant peut grignoter la surface de préparation et compliquer les déplacements. Les bonnes dimensions comptent autant que la référence." },
            { icon: "line-utensils", title: "Le service, lui, n’attend pas.", text: "Un appareil mal adapté à votre cadence peut devenir le point de blocage de toute une ligne. Partez de votre usage réel, pas seulement d’une fiche produit." },
            { icon: "line-box-check", title: "Le budget doit rester utile.", text: "Tout remplacer n’est pas toujours la priorité. Un besoin précis mérite un choix précis, en considérant aussi bien le neuf que l’occasion." },
          ],
          bridgeLead: "Le point de départ\u00a0?",
          bridgeText: "Votre espace, votre cadence, votre budget.",
          bridgeLink: action("Trouver mon rayon", anchor("rayons")),
        },
        "enjeux",
      ),
      section(
        "ChapterCatalogue",
        {
          eyebrow: "Le catalogue",
          eyebrowIcon: "line-catalogue",
          heading: "Trouvez votre\n*confort*",
          aside: "Conserver, cuire, préparer ou remplacer un poste. Entrez par ce que vous avez besoin de faire, puis comparez les équipements.",
          cards: [
            { media: m.cold, title: "Froid commercial", text: "Conservez, exposez et organisez vos produits au froid.", link: col("froid-commercial"), tone: "cold" },
            { media: m.cooking, title: "Cuisson & fours", text: "Composez une ligne de cuisson adaptée à votre carte.", link: col("cuisson"), tone: "cooking" },
            { media: m.prep, title: "Inox & préparation", text: "Faites place à la préparation, au lavage et au rangement.", link: col("inox-neutre"), tone: "prep" },
            { media: m.used, title: "Occasions & déstockage", text: "Explorez la seconde main pour votre prochain équipement.", link: pg("materiel-horeca-occasion"), tone: "used" },
          ],
          partnersLabel: "NOS PARTENAIRES",
          partners: m.partners,
        },
        "rayons",
      ),
      section(
        "ChapterUsed",
        {
          media: { ...m.used, alt: "Équipement horeca d’occasion présenté dans un espace professionnel" },
          stamp: {
            ...brand(m),
            conditions: [
              { icon: "line-box-check", label: "Neuf" },
              { icon: "line-cycle", label: "D’occasion" },
            ],
          },
          eyebrow: "Une autre voie",
          eyebrowIcon: "line-cycle",
          heading: "Votre budget compte.\n*Votre besoin aussi.*",
          body: "Ouvrir, remplacer, compléter : vous n’investissez pas pour les mêmes raisons. Comparez le neuf, les occasions et les fins de série selon ce dont votre cuisine a réellement besoin. Et si un appareil n’a plus sa place chez vous, explorez aussi la possibilité d’un rachat.",
          primary: action("Voir les occasions", pg("materiel-horeca-occasion")),
          secondary: action("Faire reprendre mon matériel", pg("rachat-materiel-horeca")),
          note: "Stock et disponibilités évoluent. Consultez les annonces en ligne ou contactez l’équipe.",
        },
        "occasions",
      ),
      section(
        "ChapterTrades",
        {
          eyebrow: "Les métiers de bouche",
          eyebrowIcon: "line-utensils",
          heading: "Chaque métier,\n*[son équipement.]*",
          aside: "Vous ne préparez pas les mêmes produits, ni au même rythme. Entrez par votre métier pour trouver un premier point de départ.",
          items: [
            { icon: "line-basket", title: "Friterie", detail: "Friteuses, cuisson & froid", link: col("friteuse") },
            { icon: "line-cleaver", title: "Boucherie", detail: "Préparation, inox & froid", link: col("preparation") },
            { icon: "line-cloche", title: "Restaurant", detail: "Du froid à la cuisson", link: col("all") },
            { icon: "line-rolling-pin", title: "Boulangerie & pâtisserie", detail: "Fours, préparation & froid", link: col("fours") },
          ],
        },
        "metiers",
      ),
      section(
        "ChapterMaterial",
        {
          texture: m.texture,
          vapour: m.film,
          poster: m.poster,
          eyebrow: "Pour le rythme du métier",
          eyebrowIcon: "line-worktable",
          heading: "Préparer.\n*[Ranger.] [Faire place.]*",
          body: "Un plan de travail dégagé, des ustensiles à portée, un rangement qui suit vos gestes. Tables, plonges, étagères et chariots vous permettent de composer des postes autour de votre façon de travailler.",
          button: action("Explorer l’inox neutre", col("inox-neutre")),
          entriesLabel: "Équipements inox",
          entries: [
            { icon: "line-worktable", kicker: "Préparer", title: "Tables", link: col("tables") },
            { icon: "line-sink", kicker: "Laver", title: "Plonges", link: col("plonge") },
            { icon: "line-shelf", kicker: "Ranger", title: "Étagères", link: col("etagere-mural") },
            { icon: "line-trolley", kicker: "Déplacer", title: "Chariots", link: col("inox-neutre-chariot") },
          ],
        },
        "inox",
      ),
      section("ChapterService", {
        label: "Services HM Froid",
        eyebrow: "Le service continue",
        eyebrowIcon: "line-wrench",
        heading: "Après le choix,\n*[la suite compte.]*",
        items: [
          { icon: "line-truck", title: "Livraison", text: "Pensez aussi au trajet jusqu’à votre cuisine. La livraison est proposée : convenez avec l’équipe des modalités pour votre équipement et vos accès." },
          { icon: "line-headset", title: "Service après-vente", text: "Un besoin de réparation après l’achat\u00a0? Vous avez un interlocuteur à contacter. HM Froid propose un service après-vente : échangez avec l’équipe sur les possibilités." },
        ],
      }),
      section(
        "ChapterVisit",
        {
          eyebrow: "Anderlecht · Bruxelles",
          eyebrowIcon: "line-pin",
          heading: "Mieux voir.\n*Mieux choisir.*",
          body: "Une fiche produit ne montre pas tout. Venez découvrir le matériel et poser vos questions au showroom d’Anderlecht. Une référence précise en tête\u00a0? Appelez avant votre visite pour vérifier sa disponibilité.",
          button: action("Itinéraire vers HM Froid", { kind: "url", value: MAPS }),
          cardTitle: "HM Froid · Showroom",
          address: "Avenue Raymond Vanderbruggen 18–20\n1070 Anderlecht, Bruxelles",
          hours: [
            { days: "Lundi – vendredi", time: "9h – 18h" },
            { days: "Samedi", time: "10h – 16h" },
          ],
          phone: PHONE,
        },
        "showroom",
      ),
      section(
        "ChapterRoute",
        {
          eyebrow: "Du besoin au choix",
          eyebrowIcon: "line-catalogue",
          heading: "Et maintenant\u00a0?",
          copy: "Pas besoin d’avoir déjà une référence en tête. Commencez par ce qui vous manque et les contraintes de votre cuisine.",
          steps: [
            { title: "Repérez votre besoin.", text: "Un appareil à remplacer, un poste à compléter\u00a0? Explorez le rayon qui vous concerne et notez vos dimensions, votre usage et votre budget.", action: action("Explorer les rayons", anchor("rayons")) },
            { title: "Parlons de votre cuisine.", text: "Appelez l’équipe ou passez au showroom avec vos mesures et vos questions. Si une référence vous intéresse, vérifiez sa disponibilité avant de vous déplacer.", action: action("Appeler l’équipe", phone) },
            { title: "Choisissez avec les bons repères.", text: "Confirmez les caractéristiques, la disponibilité et les conditions applicables. Si vous avez besoin d’une livraison, convenez de la suite avec HM Froid.", action: action("Préparer ma visite", anchor("showroom")) },
          ],
        },
        "comment-choisir",
      ),
      section(
        "ChapterFaq",
        {
          eyebrow: "Questions pratiques",
          eyebrowIcon: "line-headset",
          heading: "Avant de\n*vous décider.*",
          copy: "Les points à clarifier pour choisir en connaissance de cause. Une question sur votre situation\u00a0? Parlons-en directement.",
          button: action("Poser ma question", phone),
          items: [
            { question: "Comment choisir entre neuf et occasion\u00a0?", answer: "Partez de votre usage, des dimensions disponibles et de votre budget. HM Froid propose les deux possibilités. Comparez les caractéristiques des références qui vous intéressent et faites confirmer leur disponibilité avant de décider." },
            { question: "Puis-je voir le matériel avant de choisir\u00a0?", answer: "Vous pouvez passer au showroom, Avenue Raymond Vanderbruggen 18–20 à Anderlecht, du lundi au vendredi de 9h à 18h et le samedi de 10h à 16h. Pour un équipement précis, appelez d’abord afin de vérifier sa disponibilité." },
            { question: "Une livraison est-elle possible\u00a0?", answer: "HM Froid propose la livraison de matériel. Contactez l’équipe pour confirmer les modalités, les frais éventuels, les accès et le délai pour l’équipement qui vous intéresse." },
            { question: "Et si j’ai besoin d’une réparation\u00a0?", answer: "HM Froid propose un service après-vente pour les réparations. Expliquez votre besoin à l’équipe afin de vérifier les possibilités et les modalités." },
            { question: "J’ai du matériel à vendre. Puis-je le faire reprendre\u00a0?", answer: "HM Froid propose le rachat de matériel horeca d’occasion. Présentez votre équipement à l’équipe pour savoir si une reprise est envisageable et en discuter les modalités." },
            { question: "Que préparer avant de contacter HM Froid\u00a0?", answer: "Vos dimensions, l’usage prévu, votre budget et, si vous en avez une, la référence repérée. Pour une livraison, pensez aussi aux accès à votre établissement. Ces informations rendent l’échange plus concret." },
          ],
          structuredData: true,
        },
        "questions",
      ),
      section(
        "ChapterContact",
        {
          eyebrow: "Un besoin précis\u00a0?",
          eyebrowIcon: "line-phone",
          heading: "Évoluez\n*dans l’horeca*",
          body: "Un poste à remplacer ou un projet plus large\u00a0? Parlons de votre activité, de vos contraintes et de ce qui vous manque. Le premier pas, c’est un échange concret.",
          primary: action("Parler de mon besoin", phone),
          secondary: action("Ou venir au showroom", anchor("showroom")),
          phone: PHONE,
          hours: HOURS,
        },
        "contact",
      ),
    ],
  };
}

// ----------------------------------------------------------------- footer ---

export function chapterFooterDoc(m: ChapterMedia): DocumentData {
  return {
    root: { props: {} },
    content: [
      section("ChapterFooter", {
        brand: brand(m),
        home: home("accueil"),
        blurb: "Du matériel professionnel pour celles et ceux qui font le service.",
        links: [
          action("Rayons", home("rayons")),
          action("Occasions & rachat", home("occasions")),
          action("Showroom", home("showroom")),
          action("Comment choisir", home("comment-choisir")),
          action("Questions pratiques", home("questions")),
          action("Appeler HM Froid", phone),
        ],
        legal: [action("Mentions légales", pg("mentions-legales")), action("Confidentialité", pg("politique-de-confidentialite")), action("Conditions générales", pg("conditions-generales")), action("Plan du site", pg("plan-du-site"))],
        copyright: "© HM Froid · Anderlecht",
        since: "À Anderlecht depuis 2008",
        top: "Retour en haut ↑",
        topLink: anchor("#"),
      }),
    ],
  };
}
