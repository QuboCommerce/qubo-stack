import Link from "next/link";
import { Building2, ChevronRight, Coins, Globe, Languages, Layers, Shapes, Users } from "lucide-react";
import { siteTypePresets } from "@peltier/blocks/presets";
import { SiteAvatar } from "@/components/shell/peltier-mark";
import { Surface } from "@/components/settings/settings-group";
import { capabilityMeta } from "@/components/settings/capabilities";
import { requireSite } from "@/lib/admin";
import { localeLabel } from "@/lib/format";
import { getLocales, getMembers } from "@/lib/queries";

const roleLabel: Record<string, string> = { OWNER: "Owner", ADMIN: "Admin", STAFF: "Staff", VIEWER: "Viewer" };

/** Wide screens only: a calm summary next to the settings list. Phones see the list instead. */
export default async function SettingsIndex({ params }: { params: Promise<{ site: string }> }) {
  const { site: slug } = await params;
  const { site, siteId } = await requireSite(slug);
  const [locales, members] = await Promise.all([getLocales(siteId), getMembers(site.organizationId)]);
  const preset = siteTypePresets[site.type as keyof typeof siteTypePresets];
  const primary = locales.find((l) => l.isPrimary);
  const published = locales.filter((l) => l.isPublished && !l.isPrimary);
  const caps = site.capabilities ?? [];
  const base = `/${site.slug}/settings`;

  const rows = [
    { icon: Shapes, label: "Site type", value: preset?.label ?? site.type, href: "general" },
    {
      icon: Layers,
      label: "Features",
      value: caps.length ? caps.map((c) => capabilityMeta[c]?.label ?? c).join(", ") : "None",
      href: "general",
    },
    { icon: Coins, label: "Currency", value: site.currency, href: "general" },
    { icon: Globe, label: "Domain", value: site.domain ?? "Not connected", href: "domains" },
    {
      icon: Languages,
      label: "Languages",
      value: `${localeLabel[primary?.locale ?? site.locale] ?? site.locale}${published.length ? ` + ${published.length} published` : ""}`,
      href: "languages",
    },
    { icon: Users, label: "Team", value: `${members.length} ${members.length === 1 ? "member" : "members"} · you are ${roleLabel[site.memberRole] ?? site.memberRole}`, href: "users" },
  ];

  return (
    <div className="space-y-5 @min-[52rem]:pt-1">
      <Surface flush>
        <div className="flex items-center gap-4 border-b px-5 py-5">
          <SiteAvatar name={site.name} className="size-12 rounded-xl text-base" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold tracking-tight">{site.name}</h2>
            <p className="truncate text-[13px] text-muted-foreground">{site.description || preset?.description}</p>
          </div>
          <Link href={`${base}/general`} className="hidden h-8 items-center rounded-lg border px-3 text-[13px] font-medium shadow-xs hover:bg-accent @min-[60rem]:inline-flex">
            Edit details
          </Link>
        </div>
        <dl className="divide-y">
          {rows.map((r) => (
            <Link key={r.label} href={`${base}/${r.href}`} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent/40">
              <r.icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
              <dt className="w-28 shrink-0 text-[13px] text-muted-foreground @min-[80rem]:w-36">{r.label}</dt>
              <dd className="min-w-0 flex-1 truncate text-sm">{r.value}</dd>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 transition group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
            </Link>
          ))}
        </dl>
      </Surface>
      <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
        <Building2 className="size-3.5" />
        Settings apply to {site.name} only. Team and billing are shared across the organization.
      </p>
    </div>
  );
}
