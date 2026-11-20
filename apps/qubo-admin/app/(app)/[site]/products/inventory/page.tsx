import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Boxes, X } from "lucide-react";
import { db } from "@qubo/db/client";
import { product } from "@qubo/db/schema";
import { and, eq } from "drizzle-orm";
import { IndexToolbar, Pagination } from "@/components/index-table";
import { CategoryFilter } from "@/components/categories/category-filter";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { LiveRefresh } from "@/components/live-events";
import { EmptyState, Page, Panel } from "@/components/page";
import { Button } from "@/components/ui/button";
import { requireSite } from "@/lib/admin";
import { getCategoryTree, subtreeIds } from "@/lib/categories";
import { assetUrl } from "@/lib/format";
import { getInventory, getInventoryCounts, type StockStatus } from "@/lib/inventory";

type Search = { q?: string; status?: string; page?: string; category?: string; product?: string; item?: string };

const uuid = /^[0-9a-f-]{36}$/i;
const statuses: StockStatus[] = ["all", "low", "out", "untracked"];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("inventory");
  return { title: t("title") };
}

export default async function InventoryPage({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<Search> }) {
  const [{ site: slug }, sp] = await Promise.all([params, searchParams]);
  const [t, tl] = await Promise.all([getTranslations("inventory"), getTranslations("inventory.list")]);
  const { site, siteId, user } = await requireSite(slug);
  const status = statuses.includes(sp.status as StockStatus) ? (sp.status as StockStatus) : "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const tree = await getCategoryTree(siteId);
  const activeCategory = sp.category && uuid.test(sp.category) ? tree.find((n) => n.id === sp.category) : undefined;
  const category = sp.category === "none" ? "none" : activeCategory ? activeCategory.id : "";
  const [filterProduct] = sp.product && uuid.test(sp.product)
    ? await db.select({ id: product.id, name: product.name }).from(product).where(and(eq(product.id, sp.product), eq(product.siteId, siteId))).limit(1)
    : [];
  const filter = {
    q: sp.q,
    productId: filterProduct?.id,
    categoryIds: category === "none" ? ("none" as const) : activeCategory ? [...subtreeIds(tree, activeCategory.id)] : undefined,
  };
  const filtered = Boolean(sp.q?.trim() || filter.productId || filter.categoryIds);
  const [totals, counts, result] = await Promise.all([
    getInventoryCounts(siteId),
    filtered ? getInventoryCounts(siteId, filter) : null,
    getInventory(siteId, { ...filter, status, page }),
  ]);
  const tabCounts = counts ?? totals;

  const base = `/${site.slug}/products/inventory`;
  const keep = { ...(category ? { category } : {}), ...(filterProduct ? { product: filterProduct.id } : {}) };
  const href = (o: { category?: string; product?: string; page?: number }) => {
    const p = new URLSearchParams({ status });
    if (sp.q) p.set("q", sp.q);
    if (o.category) p.set("category", o.category);
    if (o.product) p.set("product", o.product);
    if (o.page && o.page > 1) p.set("page", String(o.page));
    return `${base}?${p}`;
  };
  const rows = result.rows.map((r) => ({ ...r, image: assetUrl(r.image) }));

  return (
    <>
      <LiveRefresh siteId={siteId} userId={user.id} tables={["inventory_item", "product"]} />
      <Page
        title={t("title")}
        subtitle={totals.all > 0 ? t("subtitle", { count: totals.all, low: totals.low, out: totals.out }) : undefined}
        backHref={`/${site.slug}/products`}
        width="wide"
      >
        {totals.all === 0 ? (
          <Panel>
            <EmptyState icon={Boxes} title={tl("emptyTitle")} description={tl("emptyDescription")} />
          </Panel>
        ) : (
          <Panel flush className="@container">
            <IndexToolbar
              basePath={base}
              active={status}
              q={sp.q}
              placeholder={tl("searchPlaceholder")}
              keep={keep}
              extra={
                tree.length > 0 && (
                  <div className="flex min-w-0 items-center gap-2 self-stretch @min-[40rem]:self-auto">
                    <CategoryFilter options={tree.map(({ id, name, depth }) => ({ id, name, depth }))} value={category} hrefBase={href({ product: filterProduct?.id })} />
                  </div>
                )
              }
              tabs={statuses.map((id) => ({ id, label: tl(`tabs.${id}`), count: tabCounts[id] }))}
            />
            {filterProduct && (
              <div className="flex items-center gap-2 border-b px-4 py-2 text-[13px]">
                <span className="min-w-0 truncate text-muted-foreground">{tl("filteredBy", { name: filterProduct.name })}</span>
                <Link href={href({ category })} className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <X className="size-3.5" /> {tl("clearFilter")}
                </Link>
              </div>
            )}
            {rows.length === 0 ? (
              <EmptyState
                icon={Boxes}
                title={tl("noResultsTitle")}
                description={tl("noResults")}
                action={filtered ? <Button variant="outline" size="sm" asChild><Link href={base}>{tl("clearFilter")}</Link></Button> : undefined}
              />
            ) : (
              <InventoryTable site={site.slug} rows={rows} initialItem={sp.item} />
            )}
            <Pagination href={(n) => href({ category, product: filterProduct?.id, page: n })} page={result.page} perPage={result.perPage} total={result.total} />
          </Panel>
        )}
      </Page>
    </>
  );
}
