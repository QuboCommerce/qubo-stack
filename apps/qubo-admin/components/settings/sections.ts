import {
  AppWindow,
  Bell,
  Building2,
  CreditCard,
  Globe,
  Inbox,
  HardDrive,
  Languages,
  Lock,
  Package,
  Palette,
  Percent,
  Plug,
  Receipt,
  Scale,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

export type SettingsSlug =
  | "general" | "business" | "brand" | "domains" | "languages" | "notifications" | "inbox" | "users" | "ai" | "sites" | "portal" | "security"
  | "payments" | "checkout" | "shipping" | "taxes" | "catalog" | "policies" | "privacy" | "integrations" | "storage";

export type SettingsGroupId = "site" | "organization" | "account" | "commerce" | "legal";

/** Labels and descriptions live in the `settings.sections` messages, keyed by slug. */
export type SettingsSection = {
  slug: SettingsSlug;
  icon: LucideIcon;
  requires?: string;
  /** false = placeholder page until its milestone lands. */
  ready?: boolean;
};

export const settingsGroups: { id: SettingsGroupId; items: SettingsSection[] }[] = [
  {
    id: "site",
    items: [
      { slug: "general", icon: Building2, ready: true },
      { slug: "business", icon: Store, ready: true },
      { slug: "brand", icon: Palette },
      { slug: "domains", icon: Globe, ready: true },
      { slug: "languages", icon: Languages, ready: true },
      { slug: "notifications", icon: Bell },
      { slug: "inbox", icon: Inbox, requires: "leads", ready: true },
    ],
  },
  {
    id: "organization",
    items: [
      { slug: "users", icon: Users, ready: true },
      { slug: "ai", icon: Sparkles, ready: true },
      { slug: "sites", icon: AppWindow, ready: true },
      { slug: "portal", icon: Plug, ready: true },
    ],
  },
  {
    id: "account",
    items: [
      { slug: "security", icon: ShieldCheck, ready: true },
    ],
  },
  {
    id: "commerce",
    items: [
      { slug: "payments", icon: CreditCard, requires: "commerce" },
      { slug: "checkout", icon: Receipt, requires: "commerce" },
      { slug: "shipping", icon: Truck, requires: "commerce" },
      { slug: "taxes", icon: Percent, requires: "commerce" },
      { slug: "catalog", icon: Package, requires: "catalog" },
    ],
  },
  {
    id: "legal",
    items: [
      { slug: "policies", icon: Scale },
      { slug: "privacy", icon: Lock },
      { slug: "integrations", icon: Plug },
      { slug: "storage", icon: HardDrive },
    ],
  },
];

export function visibleGroups(capabilities: readonly string[]) {
  const caps = new Set(capabilities);
  return settingsGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.requires || caps.has(i.requires)) }))
    .filter((g) => g.items.length);
}

export function findSection(slug: string) {
  for (const g of settingsGroups) for (const i of g.items) if (i.slug === slug) return i;
  return undefined;
}
