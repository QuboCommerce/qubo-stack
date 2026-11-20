import { getTranslations } from "next-intl/server";
import { libraryStats } from "@qubo/storage/media";
import { storageConfigured } from "@qubo/storage/server";
import { formatBytes } from "@qubo/storage";
import { MediaBrowser } from "@/components/media/quick-pick";
import { EmptyState, Page, Panel } from "@/components/page";
import { requireSite } from "@/lib/admin";
import { HardDrive } from "lucide-react";

export default async function MediaPage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await requireSite((await params).site);
  const t = await getTranslations("media.page");
  if (!storageConfigured()) {
    return (
      <Page title={t("title")} width="wide">
        <Panel>
          <EmptyState
            icon={HardDrive}
            title={t("storageTitle")}
            description={t("storageDescription")}
          />
        </Panel>
      </Page>
    );
  }
  const stats = await libraryStats(site.organizationId);
  return (
    <Page
      title={t("title")}
      subtitle={t("subtitle", { organization: site.organizationName, count: stats.files, size: formatBytes(stats.bytes) })}
      width="wide"
    >
      <Panel flush className="overflow-hidden">
        <MediaBrowser site={site.slug} siteId={site.id} className="h-[calc(100dvh-12rem)] min-h-[28rem]" />
      </Panel>
    </Page>
  );
}
