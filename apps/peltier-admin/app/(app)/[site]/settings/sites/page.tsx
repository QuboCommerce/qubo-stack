import Link from "next/link";
import { Plus } from "lucide-react";
import { siteTypePresets } from "@peltier/blocks/presets";
import { SettingsGroup, Surface } from "@/components/settings/settings-group";
import { SettingsPage } from "@/components/settings/settings-page";
import { SiteAvatar } from "@/components/shell/peltier-mark";
import { Button } from "@/components/ui/button";
import { requireSite } from "@/lib/admin";
import { localeLabel } from "@/lib/format";

export default async function SiteSettings({ params }: { params: Promise<{ site: string }> }) {
  const { site: slug } = await params;
  const { site, sites } = await requireSite(slug);
  const own = sites.filter((s) => s.organizationId === site.organizationId);

  return (
    <SettingsPage
      site={site.slug}
      title="Sites"
      description="Each site has its own domain, theme, content and settings. Customers, team and media can be shared."
      actions={
        <Button size="sm" variant="outline" disabled title="The site wizard arrives with site presets">
          <Plus /> Create site
        </Button>
      }
    >
      <SettingsGroup title="Your sites" description={`${own.length} ${own.length === 1 ? "site" : "sites"} in this organization.`}>
        <Surface flush className="divide-y">
          {own.map((s) => (
            <Link key={s.id} href={`/${s.slug}/settings/general`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40 sm:px-5">
              <SiteAvatar name={s.name} className="size-9 rounded-lg text-xs" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {s.name}
                  {s.id === site.id && <span className="ml-1.5 font-normal text-muted-foreground">(current)</span>}
                </p>
                <p className="truncate text-[13px] text-muted-foreground">
                  {siteTypePresets[s.type as keyof typeof siteTypePresets]?.label ?? s.type} · {s.domain ?? "No domain"} · {localeLabel[s.locale] ?? s.locale}
                </p>
              </div>
            </Link>
          ))}
        </Surface>
      </SettingsGroup>
    </SettingsPage>
  );
}
