import { SettingsShell } from "@/components/settings/settings-shell";
import { requireSite } from "@/lib/admin";

export default async function SettingsLayout({ params, children }: { params: Promise<{ site: string }>; children: React.ReactNode }) {
  const { site: slug } = await params;
  const { site } = await requireSite(slug);
  return (
    <SettingsShell site={site.slug} capabilities={site.capabilities ?? []}>
      {children}
    </SettingsShell>
  );
}
