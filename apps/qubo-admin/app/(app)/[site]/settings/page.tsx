import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Building2, ChevronRight, Coins, Globe, Languages, Layers, Shapes, Users } from "lucide-react";
import { siteTypePresets } from "@qubo/blocks/presets";
import { SiteAvatar } from "@/components/shell/qubo-mark";
import { Surface } from "@/components/settings/settings-group";
import { requireSite } from "@/lib/admin";
import { getFormatters } from "@/lib/format-server";
import { getLocales, getMembers } from "@/lib/queries";

const capabilityKeys = { commerce: 1, catalog: 1, booking: 1, leads: 1, blog: 1, accounts: 1, locales: 1 } as const;

/** Wide screens only: a calm summary next to the settings list. Phones see the list instead. */
export default async function SettingsIndex({ params }: { params: Promise<{ site: string }> }) {
  const t = await getTranslations("settings");
  const f = await getFormatters();
  const { site: slug } = await params;
  const { site, siteId } = await requireSite(slug);
  const [locales, members] = await Promise.all([getLocales(siteId), getMembers(site.organizationId)]);
  const typeKey = site.type as keyof typeof siteTypePresets;
  const preset = siteTypePresets[typeKey];
  const typeLabel = preset ? t(`siteTypes.${typeKey}.label`) : site.type;
  const capLabel = (c: string) => (c in capabilityKeys ? t(`capabilities.${c as keyof typeof capabilityKeys}.label`) : c);
  const role = site.memberRole as "OWNER" | "ADMIN" | "STAFF" | "VIEWER";
  const primary = locales.find((l) => l.isPrimary);
  const published = locales.filter((l) => l.isPublished && !l.isPrimary);
  const caps = site.capabilities ?? [];
  const base = `/${site.slug}/settings`;

  const rows = [
    { icon: Shapes, label: t("overview.siteType"), value: typeLabel, href: "general" },
    {
      icon: Layers,
      label: t("overview.features"),
      value: caps.length ? caps.map(capLabel).join(", ") : t("overview.none"),
      href: "general",
    },
    { icon: Coins, label: t("overview.currency"), value: site.currency, href: "general" },
    { icon: Globe, label: t("overview.domain"), value: site.domain ?? t("overview.notConnected"), href: "domains" },
    {
      icon: Languages,
      label: t("overview.languages"),
      value: `${f.localeName(primary?.locale ?? site.locale)}${published.length ? ` ${t("overview.publishedExtra", { count: published.length })}` : ""}`,
      href: "languages",
    },
    { icon: Users, label: t("overview.team"), value: t("overview.teamValue", { count: members.length, role: t(`roles.${role}`) }), href: "users" },
  ];

  return (
    <div className="space-y-5 @min-[52rem]:pt-1">
      <Surface flush>
        <div className="flex items-center gap-4 border-b px-5 py-5">
          <SiteAvatar name={site.name} className="size-12 rounded-xl text-base" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold tracking-tight">{site.name}</h2>
            <p className="truncate text-[13px] text-muted-foreground">{site.description || (preset ? t(`siteTypes.${typeKey}.description`) : "")}</p>
          </div>
          <Link href={`${base}/general`} className="hidden h-8 items-center rounded-lg border px-3 text-[13px] font-medium shadow-xs hover:bg-accent @min-[60rem]:inline-flex">
            {t("overview.editDetails")}
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
        {t("overview.footer", { name: site.name })}
      </p>
    </div>
  );
}
