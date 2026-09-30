import {
  AppWindow,
  Bell,
  Building2,
  CreditCard,
  Globe,
  HardDrive,
  Languages,
  Lock,
  Package,
  Palette,
  Percent,
  Plug,
  Receipt,
  Scale,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

export type SettingsSection = {
  slug: string;
  label: string;
  /** Used by search and page headers — never rendered in the nav itself. */
  description: string;
  icon: LucideIcon;
  requires?: string;
  /** false = placeholder page until its milestone lands. */
  ready?: boolean;
};

export const settingsGroups: { label: string; items: SettingsSection[] }[] = [
  {
    label: "Site",
    items: [
      { slug: "general", label: "General", description: "Name, site type, features and currency.", icon: Building2, ready: true },
      { slug: "brand", label: "Brand", description: "Logo variants, favicon and social sharing image.", icon: Palette },
      { slug: "domains", label: "Domains", description: "Web addresses that point to this site.", icon: Globe, ready: true },
      { slug: "languages", label: "Languages", description: "Primary language and published translations.", icon: Languages, ready: true },
      { slug: "notifications", label: "Notifications", description: "Emails sent to customers and staff.", icon: Bell },
    ],
  },
  {
    label: "Organization",
    items: [
      { slug: "users", label: "Users & permissions", description: "Who can access this organization and what they can do.", icon: Users, ready: true },
      { slug: "sites", label: "Sites", description: "Every site this organization runs from one admin.", icon: AppWindow, ready: true },
    ],
  },
  {
    label: "Commerce",
    items: [
      { slug: "payments", label: "Payments", description: "Payment providers, payouts and capture.", icon: CreditCard, requires: "commerce" },
      { slug: "checkout", label: "Checkout", description: "Customer accounts and checkout fields.", icon: Receipt, requires: "commerce" },
      { slug: "shipping", label: "Shipping & delivery", description: "Zones, rates and local pickup.", icon: Truck, requires: "commerce" },
      { slug: "taxes", label: "Taxes & duties", description: "VAT rates and tax-inclusive pricing.", icon: Percent, requires: "commerce" },
      { slug: "catalog", label: "Catalog", description: "Product types, custom fields and units.", icon: Package, requires: "catalog" },
    ],
  },
  {
    label: "Legal & advanced",
    items: [
      { slug: "policies", label: "Policies", description: "Refund, privacy and terms of service.", icon: Scale },
      { slug: "privacy", label: "Privacy & access", description: "Password page, maintenance mode and cookie banner.", icon: Lock },
      { slug: "integrations", label: "Integrations", description: "Analytics, pixels, chat and embeds.", icon: Plug },
      { slug: "storage", label: "Media storage", description: "Storage bucket, usage and image delivery.", icon: HardDrive },
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
