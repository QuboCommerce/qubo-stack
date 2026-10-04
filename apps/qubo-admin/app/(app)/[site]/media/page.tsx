import { libraryStats } from "@qubo/storage/media";
import { storageConfigured } from "@qubo/storage/server";
import { formatBytes } from "@qubo/storage";
import { MediaBrowser } from "@/components/media/quick-pick";
import { EmptyState, Page, Panel } from "@/components/page";
import { requireSite } from "@/lib/admin";
import { HardDrive } from "lucide-react";

export default async function MediaPage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await requireSite((await params).site);
  if (!storageConfigured()) {
    return (
      <Page title="Media" width="wide">
        <Panel>
          <EmptyState
            icon={HardDrive}
            title="File storage isn't set up"
            description="Set STORAGE_DIR (a folder on this server) or the STORAGE_ENDPOINT bucket settings, then restart Qubo."
          />
        </Panel>
      </Page>
    );
  }
  const stats = await libraryStats(site.organizationId);
  return (
    <Page
      title="Media"
      subtitle={`${site.organizationName} · ${stats.files} file${stats.files === 1 ? "" : "s"}, ${formatBytes(stats.bytes)}`}
      width="wide"
    >
      <Panel flush className="overflow-hidden">
        <MediaBrowser site={site.slug} siteId={site.id} className="h-[calc(100dvh-12rem)] min-h-[28rem]" />
      </Panel>
    </Page>
  );
}
