import Link from "next/link";
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
import { requireSite } from "@/lib/admin";
import { localeLabel, money, number, relativeTime } from "@/lib/format";
import { siteTypeLabel } from "@/lib/navigation";
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

export default async function HomePage({ params }: { params: Promise<{ site: string }> }) {
  const { site: slug } = await params;
  const { user, site, siteId } = await requireSite(slug);
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
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = user.name.split(" ")[0];
  const sales30 = sales.reduce((s, d) => s + d.sales, 0);
  const orders30 = sales.reduce((s, d) => s + d.orders, 0);
  const pct = (n: number) => (catalog.total ? Math.round((n / catalog.total) * 100) : 0);

  const metrics = [
    caps.has("commerce") && { label: "Sales · 30 days", value: money(sales30, site.currency ?? "EUR"), hint: `${number(orders30)} orders`, icon: TrendingUp, href: `${base}/analytics` },
    caps.has("commerce") && { label: "Open orders", value: number(counts.orders), hint: `${number(data.orderCount)} all time`, icon: ShoppingBag, href: `${base}/orders` },
    caps.has("catalog") && { label: "Products", value: number(data.productCount), hint: `${number(catalog.active)} active`, icon: Package, href: `${base}/products` },
    caps.has("accounts") && { label: "Customers", value: number(data.customerCount), hint: "imported & registered", icon: Users, href: `${base}/customers` },
    caps.has("leads") && { label: "Inbox", value: number(counts.leads), hint: "unread messages", icon: Inbox, href: `${base}/inbox` },
  ].filter(Boolean) as { label: string; value: string; hint: string; icon: typeof Package; href: string }[];

  const setup = [
    { done: !!theme, label: "Publish a theme", hint: "Colors, fonts and flavor for your site.", href: `${base}/online-store` },
    caps.has("catalog") && { done: catalog.total > 0, label: "Add products", hint: `${number(catalog.total)} products in the catalog.`, href: `${base}/products` },
    caps.has("catalog") && { done: catalog.categorized > 0, label: "Organize collections", hint: "Group products so visitors can browse.", href: `${base}/products/collections` },
    caps.has("catalog") && { done: pct(catalog.withBrand) > 50, label: "Fill in brands", hint: `${pct(catalog.withBrand)}% of products have a brand.`, href: `${base}/products` },
    { done: locales.some((l) => !l.isPrimary && l.isPublished), label: "Publish translations", hint: `${locales.length} languages configured.`, href: `${base}/settings/languages` },
    { done: !!site.domain, label: "Connect a domain", hint: site.domain ?? "Point your domain to Qubo.", href: `${base}/settings/domains` },
  ].filter(Boolean) as { done: boolean; label: string; hint: string; href: string }[];
  const doneCount = setup.filter((s) => s.done).length;

  return (
    <div className="mx-auto w-full max-w-5xl px-0 pb-16 pt-4 xs:px-3 sm:px-5 sm:pt-6 lg:px-8 lg:pt-8 xl:max-w-6xl 2xl:max-w-7xl 3xl:max-w-8xl 3xl:px-10 4xl:max-w-10xl 4xl:px-14">
      <div className="@container">
        <header className="mb-5 flex flex-wrap items-end gap-x-3 gap-y-3 px-3 xs:px-0">
          {/* title takes full row on phones so the greeting never squeezes */}
          <div className="min-w-0 flex-1 basis-full xs:basis-auto">
            <p className="truncate text-[13px] font-medium text-muted-foreground">
              {siteTypeLabel[site.type] ?? site.type} · {site.name}
            </p>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {greeting}, {firstName}
            </h1>
          </div>
          <div className="flex w-full gap-2 xs:w-auto [&>*]:flex-1 xs:[&>*]:flex-none">
            {site.domain && (
              <Button variant="outline" size="sm" asChild>
                <a href={`https://${site.domain}`} target="_blank" rel="noreferrer">
                  <Eye /> View site
                </a>
              </Button>
            )}
            <Button size="sm" asChild>
              <Link href={`${base}/online-store`}>
                <Paintbrush /> Customize
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
                title="Sales over time"
                description="Last 30 days, excluding cancelled and refunded orders."
                action={<Badge variant="secondary">{money(sales30, site.currency ?? "EUR")}</Badge>}
              >
                <SalesChart data={sales} currency={site.currency ?? "EUR"} />
              </Panel>
            )}

            {caps.has("commerce") && (
              <Panel
                title="Recent orders"
                flush
                action={
                  <Link href={`${base}/orders`} className="text-[13px] font-medium text-info hover:underline">
                    View all
                  </Link>
                }
              >
                {data.recentOrders.length === 0 ? (
                  <EmptyState
                    icon={ShoppingBag}
                    title="Your orders will show here"
                    description="Once the storefront checkout is live, new orders land here in real time."
                    className="py-10 sm:py-12"
                  />
                ) : (
                  <ul className="divide-y border-t">
                    {data.recentOrders.map((o) => (
                      <li key={o.id} className="flex items-center gap-3 px-4 py-3 text-sm sm:px-5">
                        <span className="font-medium">#{o.orderNumber}</span>
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">{o.customerName ?? "Guest"}</span>
                        <span className="hidden text-muted-foreground sm:inline">{relativeTime(o.createdAt)}</span>
                        <span className="tabular-nums">{money(o.total, o.currency)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )}

            {caps.has("catalog") && (
              <Panel title="Catalog health" description="How complete your product data is.">
                <div className="grid gap-4 @min-[40rem]:grid-cols-2 @min-[100rem]:grid-cols-4">
                  {[
                    { label: "With images", value: catalog.withImage },
                    { label: "Active", value: catalog.active },
                    { label: "In a collection", value: catalog.categorized },
                    { label: "With a brand", value: catalog.withBrand },
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
                          {number(row.value)} of {number(catalog.total)}
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
              title="Setup guide"
              description={`${doneCount} of ${setup.length} tasks complete`}
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
                title="Online Store"
                action={
                  <Link href={`${base}/online-store`} className="text-[13px] font-medium text-info hover:underline">
                    Manage
                  </Link>
                }
              >
                {theme && themeRow ? (
                  <div className="space-y-4">
                    <ThemeMiniature theme={theme} />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{theme.name}</span>
                      <Badge variant="outline" className="gap-1.5">
                        <StatusDot tone="success" /> Live
                      </Badge>
                      {themeRow.health != null && (
                        <Badge variant="secondary" className="gap-1">
                          <Sparkles className="size-3" /> Health {themeRow.health}
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
                  <EmptyState icon={Paintbrush} title="No theme yet" description="Pick a starter theme to give your site a look." className="py-8" />
                )}
              </Panel>

              <Panel title="Languages" description="Visitors see your site in these languages.">
                <ul className="space-y-2">
                  {locales.map((l) => (
                    <li key={l.locale} className="flex items-center gap-2 text-sm">
                      <span className="w-12 font-mono text-xs text-muted-foreground">{l.locale}</span>
                      <span className="flex-1">{localeLabel[l.locale] ?? l.locale}</span>
                      {l.isPrimary ? (
                        <Badge>Primary</Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1.5">
                          <StatusDot tone={l.isPublished ? "success" : "muted"} />
                          {l.isPublished ? "Published" : "Draft"}
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
