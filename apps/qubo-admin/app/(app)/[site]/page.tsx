import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ArrowUpRight,
  Check,
  CircleDashed,
  Eye,
  Inbox,
  Package,
  Paintbrush,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, Panel, StatusDot } from "@/components/page";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { SchemeChip, ThemeMiniature } from "@/components/theme-preview";
import { siteTypeKey } from "@/components/shell/labels";
import { requireSite } from "@/lib/admin";
import { getFormatters } from "@/lib/format-server";
import {
  getActiveTheme,
  getCatalogHealth,
  getDashboardData,
  getLocales,
  getSalesSeries,
  getShellCounts,
} from "@/lib/queries";
import { summarizeTheme } from "@/lib/theme-summary";
import { cn } from "@qubo/shared/utils";
import { LiveRefresh } from "@/components/live-events";

export default async function HomePage({ params }: { params: Promise<{ site: string }> }) {
  const { site: slug } = await params;
  const { user, site, siteId } = await requireSite(slug);
  const [t, tShell] = await Promise.all([getTranslations("dashboard"), getTranslations("shell")]);
  const { money, relativeTime, localeName } = await getFormatters();
  const caps = new Set<string>(site.capabilities ?? []);
  const [data, sales, catalog, themeRow, locales, counts] = await Promise.all([
    getDashboardData(siteId),
    getSalesSeries(siteId, 30),
    getCatalogHealth(siteId),
    getActiveTheme(siteId),
    getLocales(siteId),
    getShellCounts(siteId),
  ]);
  const theme = themeRow ? summarizeTheme(themeRow.published ?? themeRow.draft) : null;
  const base = `/${site.slug}`;
  const hour = new Date().getHours();
  const greetingKey = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const firstName = user.name.split(" ")[0];
  const sales30 = sales.reduce((s, d) => s + d.sales, 0);
  const orders30 = sales.reduce((s, d) => s + d.orders, 0);
  const typeKey = siteTypeKey(site.type);
  const typeLabel = typeKey ? tShell(`siteTypes.${typeKey}`) : site.type;
  const pct = (n: number) => (catalog.total ? Math.round((n / catalog.total) * 100) : 0);

  const metrics = [
    caps.has("commerce") && { label: t("metrics.sales30"), value: money(sales30, site.currency ?? "EUR"), hint: t("metrics.orders30", { count: orders30 }), icon: TrendingUp, href: `${base}/analytics` },
    caps.has("commerce") && { label: t("metrics.openOrders"), value: t("count", { count: counts.orders }), hint: t("metrics.allTime", { count: data.orderCount }), icon: ShoppingBag, href: `${base}/orders` },
    caps.has("catalog") && { label: t("metrics.products"), value: t("count", { count: data.productCount }), hint: t("metrics.activeProducts", { count: catalog.active }), icon: Package, href: `${base}/products` },
    caps.has("accounts") && { label: t("metrics.customers"), value: t("count", { count: data.customerCount }), hint: t("metrics.importedRegistered"), icon: Users, href: `${base}/customers` },
    caps.has("leads") && { label: t("metrics.inbox"), value: t("count", { count: counts.inbox }), hint: t("metrics.unreadConversations"), icon: Inbox, href: `${base}/inbox` },
  ].filter(Boolean) as { label: string; value: string; hint: string; icon: typeof Package; href: string }[];

  const setup = [
    { done: !!theme, label: t("setup.theme.label"), hint: t("setup.theme.hint"), href: `${base}/online-store` },
    caps.has("catalog") && { done: catalog.total > 0, label: t("setup.products.label"), hint: t("setup.products.hint", { count: catalog.total }), href: `${base}/products` },
    caps.has("catalog") && { done: catalog.categorized > 0, label: t("setup.collections.label"), hint: t("setup.collections.hint"), href: `${base}/products/collections` },
    caps.has("catalog") && { done: pct(catalog.withBrand) > 50, label: t("setup.brands.label"), hint: t("setup.brands.hint", { percent: pct(catalog.withBrand) }), href: `${base}/products` },
    { done: locales.some((l) => !l.isPrimary && l.isPublished), label: t("setup.translations.label"), hint: t("setup.translations.hint", { count: locales.length }), href: `${base}/settings/languages` },
    { done: !!site.domain, label: t("setup.domain.label"), hint: site.domain ?? t("setup.domain.hint"), href: `${base}/settings/domains` },
  ].filter(Boolean) as { done: boolean; label: string; hint: string; href: string }[];
  const doneCount = setup.filter((s) => s.done).length;

  return (
    <div className="mx-auto w-full max-w-5xl px-0 pb-16 pt-4 xs:px-3 sm:px-5 sm:pt-6 lg:px-8 lg:pt-8 xl:max-w-6xl 2xl:max-w-7xl 3xl:max-w-8xl 3xl:px-10 4xl:max-w-10xl 4xl:px-14">
      <LiveRefresh siteId={siteId} userId={user.id} tables={["product", "order", "site"]} />
      <div className="@container">
        <header className="mb-5 flex flex-wrap items-end gap-x-3 gap-y-3 px-3 xs:px-0">
          {/* title takes full row on phones so the greeting never squeezes */}
          <div className="min-w-0 flex-1 basis-full xs:basis-auto">
            <p className="truncate text-[13px] font-medium text-muted-foreground">
              {typeLabel} · {site.name}
            </p>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {t(`greeting.${greetingKey}`, { name: firstName })}
            </h1>
          </div>
          <div className="flex w-full gap-2 xs:w-auto [&>*]:flex-1 xs:[&>*]:flex-none">
            {site.url ? (
              <Button variant="outline" size="sm" asChild>
                <a href={site.url} target="_blank" rel="noreferrer">
                  <Eye /> {t("viewSite")}
                </a>
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link href={`${base}/settings/domains`} title={t("noDomainTitle")}>
                  <Eye /> {t("connectDomain")}
                </Link>
              </Button>
            )}
            <Button size="sm" asChild>
              <Link href={`${base}/online-store`}>
                <Paintbrush /> {t("customize")}
              </Link>
            </Button>
          </div>
        </header>

        {/* Metric strip: 1 → 2 → 3 → 5 columns by container width */}
        <div className="flex flex-wrap gap-px overflow-hidden bg-border shadow-[0_0_0_1px_var(--color-border)] xs:rounded-xl">
          {metrics.map((m) => (
            <Link
              key={m.label}
              href={m.href}
              className={cn(
                "group flex min-w-0 flex-1 basis-[10rem] flex-col gap-1 bg-card p-4 transition-colors hover:bg-accent/60 @min-[48rem]:basis-[12rem] @min-[100rem]:p-5",
              )}
            >
              <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <m.icon className="size-3.5" />
                {m.label}
                <ArrowUpRight className="ml-auto size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </span>
              <span className="text-xl font-semibold tabular-nums tracking-tight @min-[100rem]:text-2xl">{m.value}</span>
              <span className="text-xs text-muted-foreground">{m.hint}</span>
            </Link>
          ))}
        </div>

        {/* Main grid: stacked → 2/3 + 1/3 → three columns on ultrawide */}
        <div className="mt-4 grid gap-4 sm:mt-5 sm:gap-5 @min-[64rem]:grid-cols-3 @min-[120rem]:grid-cols-4">
          <div className="space-y-4 sm:space-y-5 @min-[64rem]:col-span-2 @min-[120rem]:col-span-2">
            {caps.has("commerce") && (
              <Panel
                title={t("sales.title")}
                description={t("sales.description")}
                action={<Badge variant="secondary">{money(sales30, site.currency ?? "EUR")}</Badge>}
              >
                <SalesChart data={sales} currency={site.currency ?? "EUR"} />
              </Panel>
            )}

            {caps.has("commerce") && (
              <Panel
                title={t("recentOrders.title")}
                flush
                action={
                  <Link href={`${base}/orders`} className="text-[13px] font-medium text-info hover:underline">
                    {t("recentOrders.viewAll")}
                  </Link>
                }
              >
                {data.recentOrders.length === 0 ? (
                  <EmptyState
                    icon={ShoppingBag}
                    title={t("recentOrders.emptyTitle")}
                    description={t("recentOrders.emptyDescription")}
                    className="py-10 sm:py-12"
                  />
                ) : (
                  <ul className="divide-y border-t">
                    {data.recentOrders.map((o) => (
                      <li key={o.id} className="flex items-center gap-3 px-4 py-3 text-sm sm:px-5">
                        <span className="font-medium">#{o.orderNumber}</span>
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">{o.customerName ?? t("recentOrders.guest")}</span>
                        <span className="hidden text-muted-foreground sm:inline">{relativeTime(o.createdAt)}</span>
                        <span className="tabular-nums">{money(o.total, o.currency)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )}

            {caps.has("catalog") && (
              <Panel title={t("catalog.title")} description={t("catalog.description")}>
                <div className="grid gap-4 @min-[40rem]:grid-cols-2 @min-[100rem]:grid-cols-4">
                  {[
                    { label: t("catalog.withImages"), value: catalog.withImage },
                    { label: t("catalog.active"), value: catalog.active },
                    { label: t("catalog.inCollection"), value: catalog.categorized },
                    { label: t("catalog.withBrand"), value: catalog.withBrand },
                  ].map((row) => {
                    const p = pct(row.value);
                    return (
                      <div key={row.label}>
                        <div className="flex items-baseline justify-between text-[13px]">
                          <span className="text-muted-foreground">{row.label}</span>
                          <span className="font-medium tabular-nums">{p}%</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full", p >= 90 ? "bg-success" : p >= 40 ? "bg-info" : "bg-warning")}
                            style={{ width: `${Math.max(p, 2)}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("catalog.ofTotal", { value: row.value, total: catalog.total })}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            )}
          </div>

          <div className="space-y-4 sm:space-y-5 @min-[120rem]:col-span-2 @min-[120rem]:grid @min-[120rem]:grid-cols-2 @min-[120rem]:items-start @min-[120rem]:gap-5 @min-[120rem]:space-y-0">
            <Panel
              title={t("setup.title")}
              description={t("setup.progress", { done: doneCount, total: setup.length })}
              flush
            >
              <div className="mx-4 mb-1 h-1 overflow-hidden rounded-full bg-muted sm:mx-5">
                <div className="h-full rounded-full bg-gradient-to-r from-brand-cold to-brand-hot" style={{ width: `${(doneCount / setup.length) * 100}%` }} />
              </div>
              <ul className="mt-2 divide-y border-t">
                {setup.map((s) => (
                  <li key={s.label}>
                    <Link href={s.href} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/50 sm:px-5">
                      {s.done ? (
                        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-foreground text-background">
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                      ) : (
                        <CircleDashed className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0">
                        <span className={cn("block text-sm font-medium", s.done && "text-muted-foreground line-through decoration-muted-foreground/40")}>
                          {s.label}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">{s.hint}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>

            <div className="space-y-4 sm:space-y-5">
              <Panel
                title={t("onlineStore.title")}
                action={
                  <Link href={`${base}/online-store`} className="text-[13px] font-medium text-info hover:underline">
                    {t("onlineStore.manage")}
                  </Link>
                }
              >
                {theme && themeRow ? (
                  <div className="space-y-4">
                    <ThemeMiniature theme={theme} />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{theme.name}</span>
                      <Badge variant="outline" className="gap-1.5">
                        <StatusDot tone="success" /> {t("onlineStore.live")}
                      </Badge>
                      {themeRow.health != null && (
                        <Badge variant="secondary" className="gap-1">
                          <Sparkles className="size-3" /> {t("onlineStore.health", { value: themeRow.health })}
                        </Badge>
                      )}
                      {themeRow.richness && <Badge variant="secondary" className="capitalize">{themeRow.richness}</Badge>}
                    </div>
                    <div className="grid gap-2 @min-[40rem]:grid-cols-2 @min-[64rem]:grid-cols-1">
                      {theme.schemes.slice(0, 4).map((s) => (
                        <SchemeChip key={s.id} scheme={s} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <EmptyState icon={Paintbrush} title={t("onlineStore.noThemeTitle")} description={t("onlineStore.noThemeDescription")} className="py-8" />
                )}
              </Panel>

              <Panel title={t("languages.title")} description={t("languages.description")}>
                <ul className="space-y-2">
                  {locales.map((l) => (
                    <li key={l.locale} className="flex items-center gap-2 text-sm">
                      <span className="w-12 font-mono text-xs text-muted-foreground">{l.locale}</span>
                      <span className="flex-1">{localeName(l.locale)}</span>
                      {l.isPrimary ? (
                        <Badge>{t("languages.primary")}</Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1.5">
                          <StatusDot tone={l.isPublished ? "success" : "muted"} />
                          {l.isPublished ? t("languages.published") : t("languages.draft")}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
