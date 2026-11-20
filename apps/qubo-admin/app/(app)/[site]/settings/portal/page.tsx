import { getTranslations } from "next-intl/server";
import { AlertCircle, RefreshCw, Unplug } from "lucide-react";
import { DEFAULT_PORTAL_URL, entitlementsFor, getLink } from "@qubo/portal-client";
import { refreshLicence, unlinkPortal } from "@/app/portal-actions";
import { PortalLinkForm } from "@/components/settings/portal-link-form";
import { SettingsGroup, Surface } from "@/components/settings/settings-group";
import { SettingsPage } from "@/components/settings/settings-page";
import { StatusDot } from "@/components/page";
import { Button } from "@/components/ui/button";
import { requireSite } from "@/lib/admin";
import { getFormatters } from "@/lib/format-server";

const planKeys = ["free", "starter", "growth", "agency"] as const;
const errorKeys = ["unknown_instance", "bad_signature", "clock_skew", "protocol_unsupported"] as const;

export default async function PortalSettings({ params }: { params: Promise<{ site: string }> }) {
  const t = await getTranslations("portal");
  const f = await getFormatters();
  const { site: slug } = await params;
  const { site } = await requireSite(slug);
  const link = await getLink();
  const ent = entitlementsFor(link);
  const portalUrl = process.env.PORTAL_URL || DEFAULT_PORTAL_URL;
  const fmtLimit = (n: number | null) => (n === null ? t("unlimited") : f.number(n));
  const describeError = (raw: string) => {
    const code = raw.match(/^portal \d+ (\S+)/)?.[1];
    if (code && (errorKeys as readonly string[]).includes(code)) return t(`lastError.${code as (typeof errorKeys)[number]}`);
    return /fetch|timeout|ECONN|ENOTFOUND/i.test(raw) ? t("lastError.unreachable") : raw;
  };

  const status =
    ent.source === "licence"
      ? { tone: "success" as const, text: t("status.valid", { date: f.shortDate(new Date(ent.expiresAt! * 1000)) }) }
      : ent.source === "grace"
        ? { tone: "warning" as const, text: t("status.grace", { date: f.shortDate(new Date(ent.graceEndsAt! * 1000)) }) }
        : ent.source === "expired"
          ? { tone: "warning" as const, text: t("status.expired") }
          : { tone: "muted" as const, text: t("status.unlinked") };

  return (
    <SettingsPage
      site={site.slug}
      title={t("title")}
      description={t("description")}
    >
      <div className="space-y-6 @min-[72rem]:space-y-10">
        <SettingsGroup title={t("plan")} description={t("planHelp")}>
          <Surface className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="text-lg font-semibold">{(planKeys as readonly string[]).includes(ent.plan) ? t(`plans.${ent.plan as (typeof planKeys)[number]}`) : ent.plan}</span>
              <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <StatusDot tone={status.tone} />
                {status.text}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <div><dt className="text-muted-foreground">{t("limits.orgs")}</dt><dd className="font-medium">{fmtLimit(ent.limits.orgs)}</dd></div>
              <div><dt className="text-muted-foreground">{t("limits.sites")}</dt><dd className="font-medium">{fmtLimit(ent.limits.sites)}</dd></div>
              <div><dt className="text-muted-foreground">{t("limits.seats")}</dt><dd className="font-medium">{fmtLimit(ent.limits.seats)}</dd></div>
              <div><dt className="text-muted-foreground">{t("limits.domains")}</dt><dd className="font-medium">{fmtLimit(ent.limits.customDomainsPerSite)}</dd></div>
              <div><dt className="text-muted-foreground">{t("limits.apps")}</dt><dd className="font-medium">{fmtLimit(ent.limits.cubiclesPerSite)}</dd></div>
              <div><dt className="text-muted-foreground">{t("limits.features")}</dt><dd className="font-medium">{ent.features.length ? ent.features.join(", ") : "—"}</dd></div>
            </dl>
            {ent.source === "unlinked" && (
              <p className="text-sm text-muted-foreground">{t.rich("upsell", { host: portalUrl.replace(/^https?:\/\//, ""), a: (c) => <a className="underline" href={portalUrl} target="_blank" rel="noreferrer">{c}</a> })}</p>
            )}
          </Surface>
        </SettingsGroup>

        {link ? (
          <SettingsGroup title={t("linked")} description={t("linkedHelp")}>
            <Surface className="space-y-4">
              <dl className="grid gap-y-2 text-sm sm:grid-cols-2 sm:gap-x-6">
                <div><dt className="text-muted-foreground">{t("linkedFields.portal")}</dt><dd className="font-medium">{link.portalUrl}</dd></div>
                <div><dt className="text-muted-foreground">{t("linkedFields.instanceId")}</dt><dd className="font-mono text-[13px]">{link.instanceId}</dd></div>
                <div><dt className="text-muted-foreground">{t("linkedFields.heartbeat")}</dt><dd className="font-medium">{link.lastHeartbeatAt ? f.relativeTime(link.lastHeartbeatAt) : t("never")}</dd></div>
                <div><dt className="text-muted-foreground">{t("linkedFields.fetched")}</dt><dd className="font-medium">{link.licenseFetchedAt ? f.relativeTime(link.licenseFetchedAt) : t("never")}</dd></div>
              </dl>
              {link.lastError && (
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" strokeWidth={1.8} />
                  {t("lastError.line", { error: describeError(link.lastError) })}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <form action={refreshLicence}>
                  <input type="hidden" name="site" value={site.slug} />
                  <Button size="sm" variant="outline" type="submit"><RefreshCw className="size-3.5" strokeWidth={2} /> {t("refresh")}</Button>
                </form>
                <form action={unlinkPortal}>
                  <input type="hidden" name="site" value={site.slug} />
                  <Button size="sm" variant="ghost" type="submit" title={t("unlinkHelp")}><Unplug className="size-3.5" strokeWidth={2} /> {t("unlink")}</Button>
                </form>
              </div>
            </Surface>
          </SettingsGroup>
        ) : (
          <SettingsGroup title={t("link")} description={t("linkHelp")}>
            <Surface>
              <PortalLinkForm site={site.slug} siteName={site.name} defaultPortalUrl={portalUrl} />
            </Surface>
          </SettingsGroup>
        )}
      </div>
    </SettingsPage>
  );
}
