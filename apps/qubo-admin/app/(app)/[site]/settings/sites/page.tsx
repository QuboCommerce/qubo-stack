import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { siteTypePresets } from "@qubo/blocks/presets";
import { SettingsGroup, Surface } from "@/components/settings/settings-group";
import { SettingsPage } from "@/components/settings/settings-page";
import { SiteAvatar } from "@/components/shell/qubo-mark";
import { getAccess, requireSite } from "@/lib/admin";
import { getUserOrgs } from "@/lib/shell";
import { CreateSiteButton } from "@/components/settings/create-site-button";
import { manageableOrgs, recycleBin } from "@/lib/site-ownership";
import { MoveDraftDialog, PublishSiteDialog, PurgeSiteButton, RestoreSiteButton, TrashSiteButton } from "@/components/settings/site-ownership";
import { Badge } from "@/components/ui/badge";
import { getFormatters } from "@/lib/format-server";
import { TRASH_RETENTION_DAYS } from "@qubo/studio";
import { Trash2 } from "lucide-react";

export default async function SiteSettings({ params }: { params: Promise<{ site: string }> }) {
  const t = await getTranslations("settings.sites");
  const f = await getFormatters();
  const tTypes = await getTranslations("settings.siteTypes");
  const { site: slug } = await params;
  const { site, sites } = await requireSite(slug);
  const own = sites.filter((s) => s.organizationId === site.organizationId);
  const [licence, orgs, allOrgs] = await Promise.all([getAccess(), manageableOrgs(), getUserOrgs()]);
  const canManage = orgs.some((o) => o.id === site.organizationId);
  const bin = canManage ? await recycleBin(site.organizationId) : [];
  const fallback = sites.find((s) => s.id !== site.id);
  const afterDelete = fallback ? `/${fallback.slug}/settings/sites` : "/";
  const usage = (q: { used: number; limit: number | null }, kind: "site" | "organisation") => {
    if (q.limit === null) return t(`usage.${kind}.unlimited`, { used: q.used });
    return q.used <= q.limit ? t(`usage.${kind}.within`, { used: q.used, limit: q.limit }) : t(`usage.${kind}.over`, { used: q.used, limit: q.limit });
  };
  const quotaLine = t("quota", { own: own.length, sites: usage(licence.sites, "site"), orgs: usage(licence.orgs, "organisation") });
  const createTitle = licence.sites.canCreate
    ? undefined
    : licence.entitlements.plan === "free"
      ? t("createFree")
      : t("createLimit", { plan: licence.entitlements.plan, count: licence.sites.limit ?? 0 });

  return (
    <SettingsPage
      site={site.slug}
      title={t("title")}
      description={t("description")}
      actions={
        <CreateSiteButton orgs={allOrgs} defaultOrgId={site.organizationId} disabled={!licence.sites.canCreate || !orgs.length} title={createTitle} />
      }
    >
      <SettingsGroup title={t("yours")} description={`${quotaLine} ${t("yoursHelp")}`}>
        <Surface flush className="divide-y">
          {own.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <Link href={`/${s.slug}/settings/general`} className="flex min-w-0 flex-1 items-center gap-3 rounded-md transition-opacity hover:opacity-80">
                <SiteAvatar name={s.name} className="size-9 rounded-lg text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-medium">
                    {s.name}
                    {s.id === site.id && <span className="font-normal text-muted-foreground">{t("current")}</span>}
                    <Badge variant={s.publishedAt ? "secondary" : "outline"} className="font-normal">{s.publishedAt ? t("live") : t("draft")}</Badge>
                  </p>
                  <p className="truncate text-[13px] text-muted-foreground">
                    {s.type in siteTypePresets ? tTypes(`${s.type as keyof typeof siteTypePresets}.label`) : s.type} · {s.domain ?? t("noDomain")} · {f.localeName(s.locale)}
                  </p>
                </div>
              </Link>
              {!s.publishedAt && canManage && (
                <div className="flex shrink-0 items-center gap-2">
                  <TrashSiteButton siteId={s.id} siteName={s.name} isCurrent={s.id === site.id} nextHref={afterDelete} retentionDays={TRASH_RETENTION_DAYS} />
                  <MoveDraftDialog site={s.slug} siteName={s.name} currentOrgId={s.organizationId} orgs={orgs} />
                  <PublishSiteDialog site={s.slug} siteName={s.name} currentOrgId={s.organizationId} orgs={orgs} />
                </div>
              )}
            </div>
          ))}
        </Surface>
      </SettingsGroup>

      {canManage && (
        <SettingsGroup
          title={t("bin")}
          description={t("binHelp", { days: TRASH_RETENTION_DAYS })}
        >
          <Surface flush className="divide-y">
            {bin.length === 0 ? (
              <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground sm:px-5">
                <Trash2 className="size-4" aria-hidden /> {t("binEmpty")}
              </p>
            ) : (
              bin.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <SiteAvatar name={s.name} className="size-9 rounded-lg text-xs opacity-60 grayscale" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    <p className="truncate text-[13px] text-muted-foreground">
                      {s.deletedBy ? t("deletedBy", { when: f.relativeTime(s.deletedAt), by: s.deletedBy }) : t("deleted", { when: f.relativeTime(s.deletedAt) })} · {t("daysLeft", { count: s.daysLeft })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <PurgeSiteButton siteId={s.id} siteName={s.name} />
                    <RestoreSiteButton siteId={s.id} siteName={s.name} />
                  </div>
                </div>
              ))
            )}
          </Surface>
        </SettingsGroup>
      )}
    </SettingsPage>
  );
}
