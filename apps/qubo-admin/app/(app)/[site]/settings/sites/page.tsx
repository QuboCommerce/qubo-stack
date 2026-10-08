import Link from "next/link";
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
import { localeLabel, relativeTime } from "@/lib/format";
import { TRASH_RETENTION_DAYS } from "@qubo/studio";
import { Trash2 } from "lucide-react";

export default async function SiteSettings({ params }: { params: Promise<{ site: string }> }) {
  const { site: slug } = await params;
  const { site, sites } = await requireSite(slug);
  const own = sites.filter((s) => s.organizationId === site.organizationId);
  const [licence, orgs, allOrgs] = await Promise.all([getAccess(), manageableOrgs(), getUserOrgs()]);
  const canManage = orgs.some((o) => o.id === site.organizationId);
  const bin = canManage ? await recycleBin(site.organizationId) : [];
  const fallback = sites.find((s) => s.id !== site.id);
  const afterDelete = fallback ? `/${fallback.slug}/settings/sites` : "/";
  const usage = (q: { used: number; limit: number | null }, noun: string) => {
    const plural = (n: number) => `${noun}${n === 1 ? "" : "s"}`;
    if (q.limit === null) return `${q.used} ${plural(q.used)}`;
    return q.used <= q.limit ? `${q.used} of ${q.limit} ${plural(q.limit)}` : `${q.used} ${plural(q.used)} (plan covers ${q.limit})`;
  };
  const quotaLine = `${own.length} in this organisation · ${usage(licence.sites, "site")} and ${usage(licence.orgs, "organisation")} on this instance.`;
  const createTitle = licence.sites.canCreate
    ? undefined
    : licence.entitlements.plan === "free"
      ? "Free runs one site. Link a Portal account under Settings → Qubo Portal for more."
      : `Your ${licence.entitlements.plan} plan covers ${licence.sites.limit} sites across all organisations. Delete a site to free one up, or upgrade.`;

  return (
    <SettingsPage
      site={site.slug}
      title="Sites"
      description="Each site has its own domain, theme, content and settings. Customers, team and media can be shared."
      actions={
        <CreateSiteButton orgs={allOrgs} defaultOrgId={site.organizationId} disabled={!licence.sites.canCreate || !orgs.length} title={createTitle} />
      }
    >
      <SettingsGroup title="Your sites" description={`${quotaLine} Drafts can be transferred between organisations; a published site stays in its organisation.`}>
        <Surface flush className="divide-y">
          {own.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <Link href={`/${s.slug}/settings/general`} className="flex min-w-0 flex-1 items-center gap-3 rounded-md transition-opacity hover:opacity-80">
                <SiteAvatar name={s.name} className="size-9 rounded-lg text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-medium">
                    {s.name}
                    {s.id === site.id && <span className="font-normal text-muted-foreground">(current)</span>}
                    <Badge variant={s.publishedAt ? "secondary" : "outline"} className="font-normal">{s.publishedAt ? "Live" : "Draft"}</Badge>
                  </p>
                  <p className="truncate text-[13px] text-muted-foreground">
                    {siteTypePresets[s.type as keyof typeof siteTypePresets]?.label ?? s.type} · {s.domain ?? "No domain"} · {localeLabel[s.locale] ?? s.locale}
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
          title="Recycle bin"
          description={`Deleted sites stay here for ${TRASH_RETENTION_DAYS} days, then they are removed for good. Restore one to get it back exactly as it was.`}
        >
          <Surface flush className="divide-y">
            {bin.length === 0 ? (
              <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground sm:px-5">
                <Trash2 className="size-4" aria-hidden /> Nothing in the bin.
              </p>
            ) : (
              bin.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <SiteAvatar name={s.name} className="size-9 rounded-lg text-xs opacity-60 grayscale" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    <p className="truncate text-[13px] text-muted-foreground">
                      Deleted {relativeTime(s.deletedAt)}{s.deletedBy ? ` by ${s.deletedBy}` : ""} · {s.daysLeft === 0 ? "removed today" : `${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"} left`}
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
