import Link from "next/link";
import {
  Bell,
  Building2,
  CreditCard,
  Globe,
  Languages,
  Lock,
  Package,
  Receipt,
  Scale,
  Truck,
  Users,
  Plug,
  type LucideIcon,
} from "lucide-react";
import { Page, Panel } from "@/components/page";
import { requireSite } from "@/lib/admin";
import { siteTypeLabel } from "@/lib/navigation";

type Item = { label: string; description: string; icon: LucideIcon; href: string; requires?: string };

const sections: { title: string; items: Item[] }[] = [
  {
    title: "Business",
    items: [
      { label: "General", description: "Name, contact details, addresses and site type.", icon: Building2, href: "general" },
      { label: "Users & permissions", description: "Staff accounts and what they can access.", icon: Users, href: "users" },
      { label: "Notifications", description: "Emails sent to customers and staff.", icon: Bell, href: "notifications" },
      { label: "Policies", description: "Refund, privacy and terms of service.", icon: Scale, href: "policies" },
    ],
  },
  {
    title: "Commerce",
    items: [
      { label: "Payments", description: "Providers, payout and capture settings.", icon: CreditCard, href: "payments", requires: "commerce" },
      { label: "Checkout", description: "Customer accounts and checkout fields.", icon: Receipt, href: "checkout", requires: "commerce" },
      { label: "Shipping & delivery", description: "Zones, rates and local pickup.", icon: Truck, href: "shipping", requires: "commerce" },
      { label: "Taxes & duties", description: "VAT rates and tax-inclusive pricing.", icon: Receipt, href: "taxes", requires: "commerce" },
      { label: "Catalog", description: "Product types, metafields and units.", icon: Package, href: "catalog", requires: "catalog" },
    ],
  },
  {
    title: "Site",
    items: [
      { label: "Domains", description: "Connect and manage your web addresses.", icon: Globe, href: "domains" },
      { label: "Languages", description: "Primary language and translations.", icon: Languages, href: "languages" },
      { label: "Integrations", description: "Analytics, pixels and third-party apps.", icon: Plug, href: "integrations" },
      { label: "Privacy & access", description: "Password page, maintenance mode, cookies.", icon: Lock, href: "privacy" },
    ],
  },
];

export default async function SettingsPage({ params }: { params: Promise<{ site: string }> }) {
  const { site: slug } = await params;
  const { site } = await requireSite(slug);
  const caps = new Set<string>(site.capabilities ?? []);

  return (
    <Page title="Settings" subtitle={`${site.name} · ${siteTypeLabel[site.type] ?? site.type}`} width="wide">
      <div className="@container space-y-5">
        {sections.map((section) => {
          const items = section.items.filter((i) => !i.requires || caps.has(i.requires));
          if (!items.length) return null;
          return (
            <Panel key={section.title} title={section.title} flush>
              <div className="mt-1 grid border-t @min-[40rem]:grid-cols-2 @min-[72rem]:grid-cols-3 @min-[110rem]:grid-cols-4">
                {items.map((i) => (
                  <Link
                    key={i.href}
                    href={`/${site.slug}/settings/${i.href}`}
                    className="flex items-start gap-3 border-b p-4 transition-colors hover:bg-accent/50 sm:px-5 @min-[40rem]:border-r"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                      <i.icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{i.label}</span>
                      <span className="block text-[13px] text-muted-foreground">{i.description}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </Panel>
          );
        })}
      </div>
    </Page>
  );
}
