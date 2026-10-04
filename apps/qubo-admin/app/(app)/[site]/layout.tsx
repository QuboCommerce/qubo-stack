import { AdminFrame } from "@/components/shell/admin-frame";
import type { ShellSite } from "@/components/shell/types";
import { requireSite } from "@/lib/admin";
import { getShellCounts } from "@/lib/queries";
import { LiveEvents } from "@/components/live-events";

export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ site: string }> }) {
  const { site: slug } = await params;
  const { user, site, sites, siteId } = await requireSite(slug);
  const counts = await getShellCounts(siteId);
  const toShell = (s: typeof site): ShellSite => ({
    slug: s.slug,
    name: s.name,
    type: s.type,
    capabilities: [...(s.capabilities ?? [])],
    domain: s.domain,
    url: s.url,
    organization: { id: s.organizationId, name: s.organizationName },
    locked: s.locked,
  });

  return (
    <LiveEvents siteId={siteId} userId={user.id} sessionId={user.sessionId}>
    <AdminFrame
      site={toShell(site)}
      sites={sites.map(toShell)}
      user={{ name: user.name, email: user.email, role: user.role, image: user.image }}
      counts={counts}
    >
      {children}
    </AdminFrame>
    </LiveEvents>
  );
}
