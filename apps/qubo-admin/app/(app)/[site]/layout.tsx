import { AdminFrame } from "@/components/shell/admin-frame";
import type { ShellSite } from "@/components/shell/types";
import { requireSite } from "@/lib/admin";
import { getShellCounts } from "@/lib/queries";
import { getShellAccess, getSiteSwatches, getUnreadBySite, getUserOrgs } from "@/lib/shell";
import { LiveEvents } from "@/components/live-events";
import { InboxLive } from "@/components/inbox/live";

export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ site: string }> }) {
  const { site: slug } = await params;
  const { user, site, sites, siteId } = await requireSite(slug);
  const siteIds = sites.map((s) => s.id);
  const [counts, orgs, access, swatches, unread] = await Promise.all([
    getShellCounts(siteId),
    getUserOrgs(),
    getShellAccess(),
    getSiteSwatches(siteIds),
    getUnreadBySite(siteIds),
  ]);
  const fallbackSwatch = { background: "oklch(0.98 0.005 260)", primary: "oklch(0.55 0.2 260)", text: "oklch(0.2 0.02 260)", mode: "light" as const };
  const toShell = (s: typeof site): ShellSite => ({
    slug: s.slug,
    name: s.name,
    type: s.type,
    capabilities: [...(s.capabilities ?? [])],
    domain: s.domain,
    url: s.url,
    organization: { id: s.organizationId, name: s.organizationName },
    locked: s.locked,
    published: s.publishedAt !== null,
    logo: s.logo,
    swatch: swatches[s.id] ?? fallbackSwatch,
    unread: unread[s.id] ?? 0,
  });

  return (
    <LiveEvents siteId={siteId} userId={user.id} sessionId={user.sessionId}>
      <InboxLive siteId={siteId} />
    <AdminFrame
      site={toShell(site)}
      sites={sites.map(toShell)}
      orgs={orgs}
      access={access}
      user={{ name: user.name, email: user.email, role: user.role, image: user.image }}
      counts={counts}
    >
      {children}
    </AdminFrame>
    </LiveEvents>
  );
}
