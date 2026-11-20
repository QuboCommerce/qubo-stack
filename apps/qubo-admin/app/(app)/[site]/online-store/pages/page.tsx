import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ExternalLink, FileText, Home, Lock, Paintbrush } from "lucide-react";
import type { Capability } from "@qubo/blocks";
import { blueprintCategories, suggestPages } from "@qubo/blocks/presets";
import * as studio from "@qubo/studio";
import { EmptyState, Page, Panel, StatusDot } from "@/components/page";
import { capabilityMeta } from "@/components/settings/capabilities";
import { DeletePageButton } from "@/components/pages/delete-page-button";
import { SuggestedPages } from "@/components/pages/suggested-pages";
import type { PageSuggestion } from "@/components/pages/create-page-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireSite } from "@/lib/admin";
import { getFormatters } from "@/lib/format-server";
import { studioHref } from "@/lib/view-meta";

export async function generateMetadata() {
  const t = await getTranslations("onlineStore.pages");
  return { title: t("title") };
}

export default async function PagesPage({ params }: { params: Promise<{ site: string }> }) {
  const { site: slug } = await params;
  const t = await getTranslations("onlineStore.pages");
  const { site, user } = await requireSite(slug);
  const { relativeTime } = await getFormatters();
  const pages = await studio.listPages({ siteId: site.id, userId: user.id });
  const capabilities = (site.capabilities ?? []) as Capability[];
  const suggestions: PageSuggestion[] = suggestPages({ locale: site.locale, capabilities, existingSlugs: pages.map((p) => p.slug) }).map((s) => ({
    id: s.blueprint.id,
    category: s.blueprint.category,
    categoryLabel: blueprintCategories[s.blueprint.category],
    icon: s.blueprint.icon,
    title: s.title,
    slug: s.slug,
    description: s.blueprint.description,
    missing: s.missing.map((c) => capabilityMeta[c]?.label ?? c),
    exists: s.exists,
  }));
  const settingsHref = `/${slug}/settings/general#features`;

  return (
    <Page
      title={t("title")}
      subtitle={t("subtitle")}
      width="wide"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href={`/${slug}/online-store`}><Paintbrush /> {t("themesAndTemplates")}</Link>
        </Button>
      }
    >
      <SuggestedPages site={slug} suggestions={suggestions} settingsHref={settingsHref}>
        <Panel title={t("yourPages.title")} description={t("yourPages.description", { count: pages.length })} flush>
          {pages.length === 0 ? (
            <EmptyState icon={FileText} title={t("empty.title")} description={t("empty.description")} />
          ) : (
            <ul className="mt-1 divide-y border-t">
              {pages.map((p) => {
                const live = p.state === "PUBLISHED";
                return (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm sm:px-5">
                    {p.isHomepage ? <Home className="size-4 shrink-0 text-muted-foreground" /> : <FileText className="size-4 shrink-0 text-muted-foreground" />}
                    <Link href={studioHref(slug, `page:${p.id}`)} className="min-w-0 flex-1 truncate font-medium hover:underline">
                      {p.title} <span className="font-normal text-muted-foreground">/{p.slug}</span>
                    </Link>
                    <Badge variant="outline" className="gap-1.5">
                      <StatusDot tone={live ? "success" : "muted"} /> {live ? t("published", { time: relativeTime(p.publishedAt ?? p.updatedAt) }) : t("draft")}
                    </Badge>
                    {live && site.url ? (
                      <Button variant="ghost" size="icon-sm" asChild>
                        <a href={`${site.url}/${p.slug}`} target="_blank" rel="noreferrer" aria-label={t("viewPage")}><ExternalLink /></a>
                      </Button>
                    ) : null}
                    {p.isHomepage ? <Lock className="size-3.5 text-muted-foreground" aria-label={t("homepage")} /> : <DeletePageButton site={slug} id={p.id} title={p.title} slug={p.slug} published={live} />}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </SuggestedPages>
    </Page>
  );
}
