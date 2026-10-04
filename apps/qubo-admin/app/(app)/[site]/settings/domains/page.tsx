import { Eye, Globe, RefreshCw, Server } from "lucide-react";
import { regeneratePreviewPin } from "@/app/preview-actions";
import { getPreviewPin } from "@/lib/preview-pin";
import { SettingsGroup, Surface } from "@/components/settings/settings-group";
import { SettingsPage } from "@/components/settings/settings-page";
import { StatusDot } from "@/components/page";
import { Button } from "@/components/ui/button";
import { requireSite } from "@/lib/admin";
import { getDomains } from "@/lib/queries";

export default async function DomainSettings({ params }: { params: Promise<{ site: string }> }) {
  const { site: slug } = await params;
  const { site, siteId } = await requireSite(slug);
  const [domains, pin] = await Promise.all([getDomains(siteId), getPreviewPin(siteId)]);
  const primary = domains.find((d) => d.isPrimary)?.hostname ?? domains[0]?.hostname;
  const platformBase = process.env.PLATFORM_BASE_DOMAIN?.trim();
  const previewHosts = [primary && `preview.${primary}`, platformBase && `${site.slug}.preview.${platformBase}`].filter(Boolean) as string[];

  return (
    <SettingsPage
      site={site.slug}
      title="Domains"
      description="Web addresses that open this site."
      actions={
        <Button size="sm" variant="outline" disabled title="Available once the site runs on its own server">
          Connect domain
        </Button>
      }
    >
      <div className="space-y-6 @min-[72rem]:space-y-10">
        <SettingsGroup title="Connected domains" description="The primary domain is used in links, emails and search results.">
          <Surface flush className="divide-y">
            {domains.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3.5 sm:px-5">
                <Globe className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{d.hostname}</span>
                {d.isPrimary && <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium">Primary</span>}
                <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  <StatusDot tone={d.verifiedAt ? "success" : "warning"} />
                  {d.verifiedAt ? "Connected" : "Pending DNS"}
                </span>
              </div>
            ))}
            {domains.length === 0 && <p className="px-5 py-4 text-sm text-muted-foreground">No domains yet.</p>}
          </Surface>
        </SettingsGroup>
        <SettingsGroup title="Preview" description="The unpublished site, as it is saved right now. Only people with the PIN get past the gate.">
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
                <p className="text-[13px] text-muted-foreground">Preview PIN</p>
                <p className="font-mono text-lg tracking-[0.3em]">{pin}</p>
              </div>
              <form action={regeneratePreviewPin}>
                <input type="hidden" name="site" value={site.slug} />
                <Button size="sm" variant="outline" type="submit" title="Signs every previewer out">
                  <RefreshCw className="size-3.5" strokeWidth={2} />
                  New PIN
                </Button>
              </form>
            </div>
          </Surface>
        </SettingsGroup>
        <SettingsGroup title="Hosting" description="Where the storefront is served from.">
          <Surface className="flex items-start gap-3">
            <Server className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
            <p className="text-sm text-muted-foreground">
              DNS verification and certificates are handled when the site moves to its own server. Until then, domains are listed for reference.
            </p>
          </Surface>
        </SettingsGroup>
      </div>
    </SettingsPage>
  );
}
