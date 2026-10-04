import {
  BarChart3,
  CalendarCheck,
  FileText,
  Home,
  Image,
  Inbox,
  type LucideIcon,
  Megaphone,
  Paintbrush,
  Settings,
  ShoppingBag,
  Tag,
  Users,
} from "lucide-react";

export type Capability = "commerce" | "catalog" | "booking" | "leads" | "blog" | "accounts" | "locales";

export type NavLeaf = { label: string; href: string; requires?: Capability[] };
export type NavItem = NavLeaf & {
  icon: LucideIcon;
  /** Shown as the parent's sub-menu while the section is active (Shopify style). */
  children?: NavLeaf[];
  /** Live counter key, e.g. unfulfilled orders. */
  badge?: "orders" | "inbox";
};
export type NavGroup = { label?: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    items: [
      { label: "Home", href: "", icon: Home },
      {
        label: "Orders",
        href: "/orders",
        icon: ShoppingBag,
        requires: ["commerce"],
        badge: "orders",
        children: [
          { label: "Drafts", href: "/orders/drafts" },
          { label: "Abandoned checkouts", href: "/orders/abandoned" },
        ],
      },
      {
        label: "Products",
        href: "/products",
        icon: Tag,
        requires: ["catalog"],
        children: [
          { label: "Categories", href: "/products/categories" },
          { label: "Collections", href: "/products/collections" },
          { label: "Inventory", href: "/products/inventory", requires: ["commerce"] },
          { label: "Gift cards", href: "/products/gift-cards", requires: ["commerce"] },
        ],
      },
      {
        label: "Bookings",
        href: "/bookings",
        icon: CalendarCheck,
        requires: ["booking"],
        children: [
          { label: "Services", href: "/bookings/services" },
          { label: "Availability", href: "/bookings/availability" },
        ],
      },
      {
        label: "Customers",
        href: "/customers",
        icon: Users,
        requires: ["accounts"],
        children: [{ label: "Segments", href: "/customers/segments" }],
      },
      { label: "Inbox", href: "/inbox", icon: Inbox, requires: ["leads"], badge: "inbox" },
      {
        label: "Content",
        href: "/content",
        icon: FileText,
        children: [
          { label: "Entries", href: "/content/entries" },
          { label: "Blog posts", href: "/content/blog", requires: ["blog"] },
          { label: "Menus", href: "/content/menus" },
        ],
      },
      { label: "Media", href: "/media", icon: Image },
      { label: "Marketing", href: "/marketing", icon: Megaphone, children: [{ label: "Discounts", href: "/marketing/discounts", requires: ["commerce"] }] },
      { label: "Analytics", href: "/analytics", icon: BarChart3, children: [{ label: "Reports", href: "/analytics/reports" }] },
    ],
  },
  {
    label: "Sales channels",
    items: [
      {
        label: "Online Store",
        href: "/online-store",
        icon: Paintbrush,
        children: [
          { label: "Themes", href: "/online-store" },
          { label: "Block library", href: "/online-store/blocks" },
          { label: "Pages", href: "/online-store/pages" },
          { label: "Navigation", href: "/online-store/navigation" },
          { label: "Fonts", href: "/online-store/fonts" },
          { label: "Preferences", href: "/online-store/preferences" },
        ],
      },
    ],
  },
];

export const settingsItem: NavItem = { label: "Settings", href: "/settings", icon: Settings };

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
      { label: i.label, href: i.href, icon: i.icon, parent: undefined as string | undefined },
      ...(i.children ?? []).filter((c) => c.href !== i.href).map((c) => ({ label: c.label, href: c.href, icon: i.icon, parent: i.label })),
    ]),
  ).concat([{ label: "Settings", href: "/settings", icon: settingsItem.icon, parent: undefined }]);
}

export const siteTypeLabel: Record<string, string> = {
  store: "Online store",
  services: "Services",
  business: "Business",
  editorial: "Editorial",
  custom: "Custom",
};

