import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Construction } from "lucide-react";
import { EmptyState, Page, Panel } from "@/components/page";
import { Button } from "@/components/ui/button";
import { requireSite } from "@/lib/admin";

export default async function ComingSoon({ params }: { params: Promise<{ site: string; rest: string[] }> }) {
  const { site: slug, rest } = await params;
  const { site } = await requireSite(slug);
  const t = await getTranslations("dashboard.comingSoon");
  const title = rest
    .at(-1)!
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <Page title={title} backHref={rest.length > 1 ? `/${site.slug}/${rest.slice(0, -1).join("/")}` : undefined}>
      <Panel>
        <EmptyState
          icon={Construction}
          title={t("title")}
          description={t("description", { title })}
          action={<Button variant="outline" size="sm" asChild><Link href={`/${site.slug}`}>{t("back")}</Link></Button>}
        />
      </Panel>
    </Page>
  );
}
