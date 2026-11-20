import { getTranslations } from "next-intl/server";
import { Eye, RefreshCw, Server } from "lucide-react";
import { regeneratePreviewPin } from "@/app/preview-actions";
import { getPreviewPin } from "@/lib/preview-pin";
import { SettingsGroup, Surface } from "@/components/settings/settings-group";
import { SettingsPage } from "@/components/settings/settings-page";
import { Button } from "@/components/ui/button";
import { requireSite } from "@/lib/admin";
import { getDomains } from "@/lib/queries";
import { domainContext, domainView } from "@/lib/domains";
import { DomainList } from "@/components/settings/domains/domain-list";
import { CopyButton } from "@/components/settings/domains/dns-setup";

export default async function DomainSettings({ params }: { params: Promise<{ site: string }> }) {
  const t = await getTranslations("domains");
  const { site: slug } = await params;
  const { site, siteId } = await requireSite(slug);
  const [rows, pin, ctx] = await Promise.all([getDomains(siteId), getPreviewPin(siteId), domainContext()]);
  const domains = rows.map((r) => domainView(r, ctx.ips));
  const canManage = site.memberRole === "OWNER" || site.memberRole === "ADMIN";
  const anyVerified = domains.some((d) => d.verified);
  const primary = domains.find((d) => d.isPrimary)?.hostname ?? domains[0]?.hostname;
  const platformBase = process.env.PLATFORM_BASE_DOMAIN?.trim();
  const previewHosts = [primary && `preview.${primary}`, platformBase && `${site.slug}.preview.${platformBase}`].filter(Boolean) as string[];

  return (
    <SettingsPage
      site={site.slug}
      title={t("page.title")}
      description={t("page.description")}
    >
      <div className="space-y-6 @min-[72rem]:space-y-10">
        <SettingsGroup title={t("page.connected")} description={t("page.connectedHelp")}>
          <DomainList site={site.slug} siteId={siteId} domains={domains} origin={ctx.origin} canManage={canManage} />
        </SettingsGroup>
        <SettingsGroup title={t("page.preview")} description={t("page.previewHelp")}>
          <Surface flush className="divide-y">
            {previewHosts.map((h) => (
              <div key={h} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3.5 sm:px-5">
                <Eye className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                <a href={`https://${h}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
                  {h}
                </a>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-muted-foreground">{t("page.pin")}</p>
                <p className="font-mono text-lg tracking-[0.3em]">{pin}</p>
              </div>
              <form action={regeneratePreviewPin}>
                <input type="hidden" name="site" value={site.slug} />
                <Button size="sm" variant="outline" type="submit" title={t("page.newPinHelp")}>
                  <RefreshCw className="size-3.5" strokeWidth={2} />
                  {t("page.newPin")}
                </Button>
              </form>
            </div>
          </Surface>
        </SettingsGroup>
        <SettingsGroup title={t("page.server")} description={t("page.serverHelp")}>
          <Surface flush className="divide-y">
            {ctx.ips.map((ip) => (
              <div key={ip} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <Server className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-muted-foreground">{ip.includes(":") ? t("page.ipv6") : t("page.ip")}</p>
                  <p className="font-mono text-sm">{ip}</p>
                </div>
                <CopyButton value={ip} label={t("page.ipLabel")} />
              </div>
            ))}
            {ctx.ips.length === 0 && <p className="px-5 py-4 text-sm text-muted-foreground">{t("page.noIp", { env: "QUBO_SERVER_IP" })}</p>}
            {ctx.fallbackAdmin && !anyVerified && (
              <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <Server className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-muted-foreground">{t("page.fallbackAdmin")}</p>
                  <a href={`https://${ctx.fallbackAdmin}`} className="truncate font-mono text-sm hover:underline">{ctx.fallbackAdmin}</a>
                </div>
                <CopyButton value={`https://${ctx.fallbackAdmin}`} label={t("page.adminLabel")} />
              </div>
            )}
          </Surface>
        </SettingsGroup>
      </div>
    </SettingsPage>
  );
}
