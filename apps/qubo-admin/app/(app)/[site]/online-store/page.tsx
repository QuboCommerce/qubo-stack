import { studioHref } from "@/lib/view-meta";
import Link from "next/link";
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
import { relativeTime } from "@/lib/format";
import { getActiveTheme, getTemplates } from "@/lib/queries";
import { summarizeTheme } from "@/lib/theme-summary";

const kindMeta: Record<string, { icon: LucideIcon; group: string }> = {
  home: { icon: Home, group: "Pages" },
  page: { icon: FileText, group: "Pages" },
  product: { icon: Package, group: "Catalog" },
  collection: { icon: Package, group: "Catalog" },
  collection_list: { icon: Package, group: "Catalog" },
  cart: { icon: ShoppingCart, group: "Commerce" },
  search: { icon: Search, group: "Commerce" },
  account: { icon: User, group: "Commerce" },
  service: { icon: Wrench, group: "Services" },
  booking: { icon: Wrench, group: "Services" },
  blog: { icon: BookOpen, group: "Blog" },
  article: { icon: BookOpen, group: "Blog" },
  not_found: { icon: CircleHelp, group: "System" },
  password: { icon: Lock, group: "System" },
  maintenance: { icon: Wrench, group: "System" },
};

const groupOrder = ["Pages", "Catalog", "Commerce", "Services", "Blog", "Other", "System"];

export default async function OnlineStorePage({ params }: { params: Promise<{ site: string }> }) {
  const { site: slug } = await params;
  const { site, siteId } = await requireSite(slug);
  const [themeRow, templates] = await Promise.all([getActiveTheme(siteId), getTemplates(siteId)]);
  const theme = themeRow ? summarizeTheme(themeRow.published ?? themeRow.draft) : null;

  const groups = new Map<string, typeof templates>();
  for (const t of templates) {
    const g = kindMeta[t.kind]?.group ?? "Other";
    groups.set(g, [...(groups.get(g) ?? []), t]);
  }
  const library = Object.values(builtInThemes)
    .filter((t) => t.name !== theme?.name)
    .map((t) => ({ theme: summarizeTheme(t), report: diagnoseTheme(t) }));

  return (
    <Page
      title="Themes"
      width="wide"
      actions={
        site.url ? (
          <Button variant="outline" size="sm" asChild>
            <a href={site.url} target="_blank" rel="noreferrer">View your store</a>
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
                    <Badge variant="outline" className="gap-1.5"><StatusDot tone="success" /> Current theme</Badge>
                  </div>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {themeRow.publishedAt ? `Published ${relativeTime(themeRow.publishedAt)}` : "Not published yet"} · {theme.flavor} flavor · {theme.modeStrategy} mode
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {themeRow.health != null && <Badge variant="secondary" className="gap-1"><Sparkles className="size-3" /> Palette health {themeRow.health}/100</Badge>}
                  {themeRow.richness && <Badge variant="secondary" className="capitalize">{themeRow.richness} pack</Badge>}
                  <Badge variant="secondary">{theme.schemes.length} schemes</Badge>
                  <Badge variant="secondary">{theme.buttons} button styles</Badge>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Fonts</p>
                  <p className="text-sm">{theme.fonts.join(" · ")}</p>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Palette</p>
                  <div className="flex flex-wrap gap-1.5">
                    {theme.palette.map((p) => (
                      <span key={p.id} title={`${p.name} · ${p.value}`} className="size-7 rounded-md ring-1 ring-black/10" style={{ background: p.value }} />
                    ))}
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  <Button asChild><Link href={`/${slug}/studio`}><Paintbrush /> Customize</Link></Button>
                  <Button variant="outline" asChild><Link href={`/${slug}/studio?panel=theme`}><Palette /> Theme settings</Link></Button>
                </div>
              </div>
            </div>
            <div className="grid gap-2 border-t p-4 @min-[40rem]:grid-cols-2 @min-[72rem]:grid-cols-3 @min-[110rem]:grid-cols-4 sm:p-5">
              {theme.schemes.map((s) => <SchemeChip key={s.id} scheme={s} />)}
            </div>
          </Panel>
        ) : (
          <Panel><EmptyState icon={Paintbrush} title="No theme yet" description="Pick a theme from the library below." /></Panel>
        )}

        <div className="mt-5 grid gap-5 @min-[80rem]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Panel title="Templates" description="Every page type your site can render. System pages are managed by Qubo and can't be deleted." flush>
            <div className="mt-1 border-t">
              {[...groups.entries()].sort((a, b) => groupOrder.indexOf(a[0]) - groupOrder.indexOf(b[0])).map(([group, items]) => (
                <div key={group}>
                  <p className="bg-muted/40 px-4 py-1.5 text-xs font-medium text-muted-foreground sm:px-5">{group}</p>
                  <ul className="divide-y">
                    {items.map((t) => {
                      const Icon = kindMeta[t.kind]?.icon ?? FileText;
                      return (
                        <li key={t.id}>
                          <Link href={studioHref(slug, `template:${t.id}`)} className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-accent/50 sm:px-5">
                            <Icon className="size-4 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 flex-1 truncate font-medium">{t.name}</span>
                            {t.isSystem && <Lock className="size-3.5 text-muted-foreground" aria-label="System page" />}
                            <span className="hidden text-xs text-muted-foreground xs:inline">
                              {t.publishedAt ? `Published ${relativeTime(t.publishedAt)}` : "Draft"}
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

          <Panel title="Theme library" description="StyleKit packs, scored by the Palette Doctor.">
            <div className="grid gap-3 @min-[40rem]:grid-cols-2 @min-[80rem]:grid-cols-1 @min-[110rem]:grid-cols-2">
              {library.map(({ theme: t, report }) => (
                <div key={t.name} className="overflow-hidden rounded-xl border">
                  <ThemeMiniature theme={t} className="rounded-none border-0 border-b shadow-none" />
                  <div className="flex items-center gap-2 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.name}</p>
                      <p className="text-xs capitalize text-muted-foreground">{report.richness.tier} · {t.flavor}</p>
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
