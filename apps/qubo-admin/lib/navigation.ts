import {
  BadgePercent,
  BarChart3,
  CalendarCheck,
  FileText,
  Home,
  Image,
  Inbox,
  type LucideIcon,
  Paintbrush,
  Settings,
  ShoppingBag,
  Tag,
  Users,
} from "lucide-react";

export type Capability = "commerce" | "catalog" | "booking" | "leads" | "blog" | "accounts" | "locales";

import type en from "@/messages/en";
import { channelIcon, ticketIcon } from "@/components/inbox/icons";

/** Keys of the `nav` namespace in messages/en.json. */
export type NavKey = keyof (typeof en)["nav"];

export type NavLeaf = { key: NavKey; href: string; requires?: Capability[]; icon?: LucideIcon };
export type NavItem = NavLeaf & {
  icon: LucideIcon;
  /** Shown as the parent's sub-menu while the section is active (Shopify style). */
  children?: NavLeaf[];
  /** Live counter key, e.g. unfulfilled orders. */
  badge?: "orders" | "inbox";
};
export type NavGroup = { key?: NavKey; items: NavItem[] };

const groups: NavGroup[] = [
  {
    items: [
      { key: "home", href: "", icon: Home },
      {
        key: "orders",
        href: "/orders",
        icon: ShoppingBag,
        requires: ["commerce"],
        badge: "orders",
        children: [
          { key: "drafts", href: "/orders/drafts" },
          { key: "abandonedCheckouts", href: "/orders/abandoned" },
        ],
      },
      {
        key: "products",
        href: "/products",
        icon: Tag,
        requires: ["catalog"],
        children: [
          { key: "categories", href: "/products/categories" },
          { key: "collections", href: "/products/collections" },
          { key: "inventory", href: "/products/inventory", requires: ["commerce"] },
        ],
      },
      {
        key: "bookings",
        href: "/bookings",
        icon: CalendarCheck,
        requires: ["booking"],
        children: [
          { key: "services", href: "/bookings/services" },
          { key: "availability", href: "/bookings/availability" },
        ],
      },
      {
        key: "customers",
        href: "/customers",
        icon: Users,
        requires: ["accounts"],
        children: [{ key: "segments", href: "/customers/segments" }],
      },
      {
        key: "inbox",
        href: "/inbox",
        icon: Inbox,
        requires: ["leads"],
        badge: "inbox",
        children: [
          { key: "inboxForms", href: "/inbox/forms", icon: channelIcon.form },
          { key: "inboxEmail", href: "/inbox/email", icon: channelIcon.email },
          { key: "inboxChats", href: "/inbox/chats", icon: channelIcon.chat },
          { key: "inboxTickets", href: "/inbox/tickets", icon: ticketIcon },
        ],
      },
      {
        key: "content",
        href: "/content",
        icon: FileText,
        children: [
          { key: "entries", href: "/content/entries" },
          { key: "blogPosts", href: "/content/blog", requires: ["blog"] },
          { key: "menus", href: "/content/menus" },
        ],
      },
      { key: "media", href: "/media", icon: Image },
      {
        key: "promotions",
        href: "/promotions",
        icon: BadgePercent,
        requires: ["commerce"],
        children: [{ key: "discountCodes", href: "/promotions/codes" }],
      },
      { key: "analytics", href: "/analytics", icon: BarChart3, children: [{ key: "reports", href: "/analytics/reports" }] },
    ],
  },
  {
    key: "salesChannels",
    items: [
      {
        key: "onlineStore",
        href: "/online-store",
        icon: Paintbrush,
        children: [
          { key: "themes", href: "/online-store" },
          { key: "blockLibrary", href: "/online-store/blocks" },
          { key: "pages", href: "/online-store/pages" },
          { key: "navigation", href: "/online-store/navigation" },
          { key: "fonts", href: "/online-store/fonts" },
          { key: "preferences", href: "/online-store/preferences" },
        ],
      },
    ],
  },
];

export const settingsItem: NavItem = { key: "settings", href: "/settings", icon: Settings };

const allowed = (caps: readonly string[], requires?: Capability[]) => !requires || requires.every((c) => caps.includes(c));

/** The sidebar for a site: items whose capabilities are off disappear entirely. */
export function navigationFor(capabilities: readonly string[]): NavGroup[] {
  return groups
    .map((g) => ({
      ...g,
      items: g.items
        .filter((i) => allowed(capabilities, i.requires))
        .map((i) => ({ ...i, children: i.children?.filter((c) => allowed(capabilities, c.requires)) })),
    }))
    .filter((g) => g.items.length);
}

/** Flat list for the command palette and breadcrumbs. */
export function flatNavigation(capabilities: readonly string[]) {
  return navigationFor(capabilities).flatMap((g) =>
    g.items.flatMap((i) => [
      { key: i.key, href: i.href, icon: i.icon, parent: undefined as NavKey | undefined },
      ...(i.children ?? []).filter((c) => c.href !== i.href).map((c) => ({ key: c.key, href: c.href, icon: i.icon, parent: i.key })),
    ]),
  ).concat([{ key: "settings", href: "/settings", icon: settingsItem.icon, parent: undefined as NavKey | undefined }]);
}

export const siteTypeLabel: Record<string, string> = {
  store: "Online store",
  services: "Services",
  business: "Business",
  editorial: "Editorial",
  custom: "Custom",
};

