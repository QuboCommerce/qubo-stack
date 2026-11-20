import { studioHref } from "@/lib/view-meta";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  BookOpen,
  CircleHelp,
  FileText,
  Home,
  Lock,
  Palette,
  Package,
  Paintbrush,
  Search,
  ShoppingCart,
  Sparkles,
  User,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { builtInThemes, diagnoseTheme } from "@qubo/stylekit";
import { EmptyState, Page, Panel, StatusDot } from "@/components/page";
import { SchemeChip, ThemeMiniature } from "@/components/theme-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireSite } from "@/lib/admin";
import { getFormatters } from "@/lib/format-server";
import { getActiveTheme, getTemplates } from "@/lib/queries";
import { summarizeTheme } from "@/lib/theme-summary";

const kindMeta: Record<string, { icon: LucideIcon; group: (typeof groupOrder)[number] }> = {
  home: { icon: Home, group: "pages" },
  page: { icon: FileText, group: "pages" },
  product: { icon: Package, group: "catalog" },
  collection: { icon: Package, group: "catalog" },
  collection_list: { icon: Package, group: "catalog" },
  cart: { icon: ShoppingCart, group: "commerce" },
  search: { icon: Search, group: "commerce" },
  account: { icon: User, group: "commerce" },
  service: { icon: Wrench, group: "services" },
  booking: { icon: Wrench, group: "services" },
  blog: { icon: BookOpen, group: "blog" },
  article: { icon: BookOpen, group: "blog" },
  not_found: { icon: CircleHelp, group: "system" },
  password: { icon: Lock, group: "system" },
  maintenance: { icon: Wrench, group: "system" },
};

const groupOrder = ["pages", "catalog", "commerce", "services", "blog", "other", "system"] as const;

export default async function OnlineStorePage({ params }: { params: Promise<{ site: string }> }) {
  const { site: slug } = await params;
  const t = await getTranslations("onlineStore.themes");
  const { relativeTime } = await getFormatters();
  const { site, siteId } = await requireSite(slug);
  const [themeRow, templates] = await Promise.all([getActiveTheme(siteId), getTemplates(siteId)]);
  const theme = themeRow ? summarizeTheme(themeRow.published ?? themeRow.draft) : null;

  const groups = new Map<(typeof groupOrder)[number], typeof templates>();
  for (const tpl of templates) {
    const g = kindMeta[tpl.kind]?.group ?? "other";
    groups.set(g, [...(groups.get(g) ?? []), tpl]);
  }
  const library = Object.values(builtInThemes)
    .filter((b) => b.name !== theme?.name)
    .map((b) => ({ theme: summarizeTheme(b), report: diagnoseTheme(b) }));

  return (
    <Page
      title={t("title")}
      width="wide"
      actions={
        site.url ? (
          <Button variant="outline" size="sm" asChild>
            <a href={site.url} target="_blank" rel="noreferrer">{t("viewStore")}</a>
          </Button>
        ) : undefined
      }
    >
      <div className="@container">
        {theme && themeRow ? (
          <Panel flush>
            <div className="grid @min-[48rem]:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] @min-[90rem]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <div className="border-b bg-gradient-to-br from-brand-cold/10 via-muted/40 to-brand-hot/10 p-4 @min-[48rem]:border-b-0 @min-[48rem]:border-r sm:p-6 @min-[90rem]:p-10">
                <ThemeMiniature theme={theme} className="mx-auto max-w-2xl bg-card shadow-lg" />
              </div>
              <div className="flex flex-col gap-4 p-4 sm:p-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-tight">{theme.name}</h2>
                    <Badge variant="outline" className="gap-1.5"><StatusDot tone="success" /> {t("current")}</Badge>
                  </div>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {t("meta", {
                      published: themeRow.publishedAt ? t("published", { time: relativeTime(themeRow.publishedAt) }) : t("notPublished"),
                      flavor: theme.flavor,
                      mode: t(`modes.${theme.modeStrategy}`),
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {themeRow.health != null && <Badge variant="secondary" className="gap-1"><Sparkles className="size-3" /> {t("health", { score: themeRow.health })}</Badge>}
                  {themeRow.richness && <Badge variant="secondary">{t("pack", { tier: t(`richness.${themeRow.richness as "essential" | "complete" | "premium"}`) })}</Badge>}
                  <Badge variant="secondary">{t("schemes", { count: theme.schemes.length })}</Badge>
                  <Badge variant="secondary">{t("buttons", { count: theme.buttons })}</Badge>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("fonts")}</p>
                  <p className="text-sm">{theme.fonts.join(" · ")}</p>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("palette")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {theme.palette.map((p) => (
                      <span key={p.id} title={`${p.name} · ${p.value}`} className="size-7 rounded-md ring-1 ring-black/10" style={{ background: p.value }} />
                    ))}
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  <Button asChild><Link href={`/${slug}/studio`}><Paintbrush /> {t("customize")}</Link></Button>
                  <Button variant="outline" asChild><Link href={`/${slug}/studio?panel=theme`}><Palette /> {t("themeSettings")}</Link></Button>
                </div>
              </div>
            </div>
            <div className="grid gap-2 border-t p-4 @min-[40rem]:grid-cols-2 @min-[72rem]:grid-cols-3 @min-[110rem]:grid-cols-4 sm:p-5">
              {theme.schemes.map((s) => <SchemeChip key={s.id} scheme={s} />)}
            </div>
          </Panel>
        ) : (
          <Panel><EmptyState icon={Paintbrush} title={t("empty.title")} description={t("empty.description")} /></Panel>
        )}

        <div className="mt-5 grid gap-5 @min-[80rem]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Panel title={t("templates.title")} description={t("templates.description")} flush>
            <div className="mt-1 border-t">
              {[...groups.entries()].sort((a, b) => groupOrder.indexOf(a[0]) - groupOrder.indexOf(b[0])).map(([group, items]) => (
                <div key={group}>
                  <p className="bg-muted/40 px-4 py-1.5 text-xs font-medium text-muted-foreground sm:px-5">{t(`templates.groups.${group}`)}</p>
                  <ul className="divide-y">
                    {items.map((tpl) => {
                      const Icon = kindMeta[tpl.kind]?.icon ?? FileText;
                      return (
                        <li key={tpl.id}>
                          <Link href={studioHref(slug, `template:${tpl.id}`)} className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-accent/50 sm:px-5">
                            <Icon className="size-4 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 flex-1 truncate font-medium">{tpl.name}</span>
                            {tpl.isSystem && <Lock className="size-3.5 text-muted-foreground" aria-label={t("templates.systemPage")} />}
                            <span className="hidden text-xs text-muted-foreground xs:inline">
                              {tpl.publishedAt ? t("published", { time: relativeTime(tpl.publishedAt) }) : t("templates.draft")}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title={t("library.title")} description={t("library.description")}>
            <div className="grid gap-3 @min-[40rem]:grid-cols-2 @min-[80rem]:grid-cols-1 @min-[110rem]:grid-cols-2">
              {library.map(({ theme: lib, report }) => (
                <div key={lib.name} className="overflow-hidden rounded-xl border">
                  <ThemeMiniature theme={lib} className="rounded-none border-0 border-b shadow-none" />
                  <div className="flex items-center gap-2 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{lib.name}</p>
                      <p className="text-xs text-muted-foreground">{t(`richness.${report.richness.tier}`)} · {lib.flavor}</p>
                    </div>
                    <Badge variant="secondary" className="tabular-nums">{report.health}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </Page>
  );
}
