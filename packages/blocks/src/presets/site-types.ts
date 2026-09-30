import { instantiate, type BlockRegistry, type Capability, type DocumentData, type SiteType, type SlotNode } from "../core";
import { registry as defaultRegistry } from "../library";

export type ResourceKind =
  | "home"
  | "page"
  | "product"
  | "collection"
  | "collection_list"
  | "cart"
  | "search"
  | "service"
  | "booking"
  | "blog"
  | "article"
  | "account"
  | "not_found"
  | "password"
  | "maintenance";

export type TemplateSeed = { kind: ResourceKind; name: string; isSystem?: boolean };

export type SiteTypePreset = {
  type: SiteType;
  label: string;
  description: string;
  /** lucide icon name, used by the site switcher and create-site wizard. */
  icon: string;
  capabilities: Capability[];
  templates: TemplateSeed[];
  defaultFlavor: "fancy" | "grounded";
};

const system: TemplateSeed[] = [
  { kind: "not_found", name: "404", isSystem: true },
  { kind: "password", name: "Password", isSystem: true },
  { kind: "maintenance", name: "Maintenance", isSystem: true },
];
const base: TemplateSeed[] = [
  { kind: "home", name: "Home page" },
  { kind: "page", name: "Default page" },
  { kind: "search", name: "Search" },
];

/**
 * A site type is an optimal starting point for an objective. It only seeds
 * capabilities and templates; everything stays toggleable afterwards.
 */
export const siteTypePresets: Record<SiteType, SiteTypePreset> = {
  store: {
    type: "store",
    label: "Online store",
    description: "Sell products with a catalog, cart and checkout.",
    icon: "store",
    capabilities: ["commerce", "catalog", "accounts", "leads", "locales"],
    templates: [
      ...base,
      { kind: "product", name: "Default product" },
      { kind: "collection", name: "Default collection" },
      { kind: "collection_list", name: "Collections list" },
      { kind: "cart", name: "Cart" },
      { kind: "account", name: "Customer account" },
      ...system,
    ],
    defaultFlavor: "fancy",
  },
  services: {
    type: "services",
    label: "Services & bookings",
    description: "Present services and take bookings — clinics, studios, coaches.",
    icon: "calendar-check",
    capabilities: ["booking", "leads", "accounts", "locales"],
    templates: [...base, { kind: "service", name: "Default service" }, { kind: "booking", name: "Booking" }, { kind: "account", name: "Member area" }, ...system],
    defaultFlavor: "fancy",
  },
  business: {
    type: "business",
    label: "Business showcase",
    description: "Generate leads for a company that sells offline — quotes, calls, visits.",
    icon: "building-2",
    capabilities: ["leads", "locales"],
    templates: [...base, ...system],
    defaultFlavor: "grounded",
  },
  editorial: {
    type: "editorial",
    label: "Blog & editorial",
    description: "Publish articles and grow an audience.",
    icon: "newspaper",
    capabilities: ["blog", "leads", "locales"],
    templates: [...base, { kind: "blog", name: "Blog" }, { kind: "article", name: "Default article" }, ...system],
    defaultFlavor: "grounded",
  },
  custom: {
    type: "custom",
    label: "Custom",
    description: "Start empty and switch on only what you need.",
    icon: "blocks",
    capabilities: [],
    templates: [...base, ...system],
    defaultFlavor: "fancy",
  },
};

const titles: Partial<Record<ResourceKind, [string, string]>> = {
  search: ["Search", "Find products, pages and articles."],
  cart: ["Your cart", "Review your items before checkout."],
  account: ["Your account", "Orders, addresses and preferences."],
  password: ["Opening soon", "This site is password protected."],
  maintenance: ["Back shortly", "We're doing some maintenance. Please check back soon."],
  booking: ["Book an appointment", "Pick a service and a time that suits you."],
};

/** Starter document for a template; merchants replace it in the Studio. */
export function templateStarter(kind: ResourceKind, registry: BlockRegistry = defaultRegistry): DocumentData {
  const make = (type: string, opts: { preset?: string; props?: Record<string, unknown> } = {}) => instantiate(registry, type, opts);
  const text = (title: string, intro: string): SlotNode =>
    make("RichText", {
      props: {
        content: [
          { type: "Heading", props: { text: title, level: "h1" } },
          { type: "Text", props: { body: `<p>${intro}</p>` } },
        ],
      },
    });
  let content: SlotNode[];
  switch (kind) {
    case "home":
      content = [make("Hero"), make("FeatureGrid"), make("CtaBand")];
      break;
    case "not_found":
      content = [make("Section", { preset: "not-found" })];
      break;
    case "product":
    case "collection":
    case "collection_list":
      content = [make("ProductGrid")];
      break;
    case "blog":
      content = [make("PostList")];
      break;
    case "page":
    case "article":
    case "service":
      content = [make("RichText")];
      break;
    default: {
      const [title, intro] = titles[kind] ?? ["Untitled", ""];
      content = [text(title, intro)];
    }
  }
  return { root: { props: {} }, content };
}
