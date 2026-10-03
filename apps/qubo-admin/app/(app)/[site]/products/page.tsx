import Link from "next/link";
import { Archive, ArchiveRestore, ImageOff, LayoutGrid, List, Package, Plus, Upload } from "lucide-react";
import { toggleProductArchive } from "@/app/actions";
import { IndexToolbar, Pagination, td, th } from "@/components/index-table";
import { CategoryFilter } from "@/components/categories/category-filter";
import { EmptyState, Page, Panel } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireSite } from "@/lib/admin";
import { getCategoryTree, subtreeIds } from "@/lib/categories";
import { assetUrl, money, number, relativeTime } from "@/lib/format";
import { getCatalogHealth, getProducts } from "@/lib/queries";
import { cn } from "@qubo/shared/utils";
import { LiveRefresh } from "@/components/live-events";
import { RowPresence } from "@/components/presence";

type Search = { q?: string; status?: string; page?: string; view?: string; category?: string };

const uuid = /^[0-9a-f-]{36}$/i;

export default async function ProductsPage({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<Search> }) {
  const [{ site: slug }, sp] = await Promise.all([params, searchParams]);
  const { site, siteId, user } = await requireSite(slug);
  const status = sp.status === "active" || sp.status === "archived" ? sp.status : "all";
  const page = Number(sp.page) || 1;
  const tree = await getCategoryTree(siteId);
  const activeCategory = sp.category === "none" ? null : sp.category && uuid.test(sp.category) ? tree.find((n) => n.id === sp.category) : undefined;
  const category = sp.category === "none" ? "none" : activeCategory ? activeCategory.id : "";
  const [result, health] = await Promise.all([
    getProducts(siteId, { q: sp.q, status, page, categoryIds: category === "none" ? "none" : activeCategory ? [...subtreeIds(tree, activeCategory.id)] : undefined }),
    getCatalogHealth(siteId),
  ]);
  const base = `/${site.slug}/products`;
  const view = sp.view === "grid" ? "grid" : "list";
  const keep = { ...(view === "grid" ? { view } : {}), ...(category ? { category } : {}) };
  const href = (o: { view?: string; category?: string; page?: number }) => {
    const p = new URLSearchParams({ status });
    if (sp.q) p.set("q", sp.q);
    if (o.view === "grid") p.set("view", "grid");
    if (o.category) p.set("category", o.category);
    if (o.page) p.set("page", String(o.page));
    return `${base}?${p}`;
  };
  const qs = (n: number) => href({ view, category, page: n });
  const viewHref = (v: string) => href({ view: v, category });
  const currency = site.currency ?? "EUR";

  return (
    <>
    <LiveRefresh siteId={siteId} userId={user.id} tables={["product", "category"]} />
    <Page
      title="Products"
      width="wide"
      actions={
        <>
          <Button variant="outline" size="sm" className="flex-1 xs:flex-none"><Upload /> Import</Button>
          <Button size="sm" className="flex-1 xs:flex-none" asChild><Link href={`/${site.slug}/products/new`}><Plus /> Add product</Link></Button>
        </>
      }
    >
      {health.total === 0 ? (
        <Panel>
          <EmptyState icon={Package} title="Add your first product" description="Products appear on your storefront once they're active." />
        </Panel>
      ) : (
        <Panel flush className="@container">
          <IndexToolbar
            basePath={base}
            active={status}
            q={sp.q}
            placeholder="Search by name, brand or handle"
            keep={keep}
            extra={
              <div className="flex min-w-0 items-center gap-2 self-stretch @min-[40rem]:self-auto">
              {tree.length > 0 && (
                <CategoryFilter options={tree.map(({ id, name, depth }) => ({ id, name, depth }))} value={category} hrefBase={href({ view })} />
              )}
              <div className="ml-auto flex shrink-0 rounded-lg border p-0.5" role="group" aria-label="View">
                {([["list", List, "List view"], ["grid", LayoutGrid, "Grid view"]] as const).map(([id, Icon, label]) => (
                  <Link key={id} href={viewHref(id)} title={label} aria-label={label} aria-current={view === id ? "true" : undefined}
                    className={cn("grid size-7 place-items-center rounded-md transition-colors", view === id ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>
                    <Icon className="size-4" />
                  </Link>
                ))}
              </div>
              </div>
            }
            tabs={[
              { id: "all", label: "All", count: health.total },
              { id: "active", label: "Active", count: health.active },
              { id: "archived", label: "Archived", count: health.total - health.active },
            ]}
          />
          {result.rows.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No products found"
              description={category ? "Nothing matches in this category. Try another one or clear the filter." : "Try changing the filters or search term."}
              action={category ? <Button variant="outline" size="sm" asChild><Link href={href({ view })}>Clear category</Link></Button> : undefined}
            />
          ) : view === "grid" ? (
            <ul className="grid grid-cols-2 gap-3 p-3 @min-[36rem]:grid-cols-3 @min-[56rem]:grid-cols-4 @min-[72rem]:grid-cols-5 @min-[96rem]:grid-cols-6 @min-[120rem]:grid-cols-8">
              {result.rows.map((p) => {
                const img = assetUrl(p.image);
                return (
                  <li key={p.id}>
                    <Link href={`${base}/${p.id}`} className="group flex h-full flex-col overflow-hidden rounded-xl border bg-card transition hover:border-foreground/20 hover:shadow-md">
                      <div className="relative grid aspect-square place-items-center bg-white p-3">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt="" loading="lazy" className="size-full object-contain transition-transform group-hover:scale-[1.03]" />
                        ) : (
                          <ImageOff className="size-6 text-muted-foreground" />
                        )}
                        {p.isArchived && <Badge variant="secondary" className="absolute left-2 top-2">Archived</Badge>}
                        <RowPresence path={`${base}/${p.id}`} className="absolute bottom-2 right-2" />
                      </div>
                      <div className="flex flex-1 flex-col gap-1 border-t p-3">
                        <p className="line-clamp-2 text-[13px] font-medium leading-snug">{p.name}</p>
                        <p className="mt-auto flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground tabular-nums">{money(p.basePrice, currency)}</span>
                          <span className="truncate">{p.inventory == null ? "" : `${number(p.inventory)} in stock`}</span>
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className={cn(th, "w-full")}>Product</th>
                    <th className={cn(th, "hidden @min-[36rem]:table-cell")}>Status</th>
                    <th className={cn(th, "hidden @min-[56rem]:table-cell")}>Inventory</th>
                    <th className={cn(th, "hidden @min-[48rem]:table-cell")}>Variants</th>
                    <th className={cn(th, "hidden @min-[72rem]:table-cell")}>Brand</th>
                    <th className={cn(th, "hidden @min-[90rem]:table-cell")}>Updated</th>
                    <th className={cn(th, "text-right")}>Price</th>
                    <th className={cn(th, "w-10")}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {result.rows.map((p) => {
                    const img = assetUrl(p.image);
                    return (
                      <tr key={p.id} className="group transition-colors hover:bg-accent/40">
                        <td className={cn(td, "w-full max-w-0")}>
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border bg-white @min-[90rem]:size-11">
                              {img ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={img} alt="" loading="lazy" className="size-full object-contain" />
                              ) : (
                                <ImageOff className="size-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <Link href={`${base}/${p.id}`} className="line-clamp-2 font-medium hover:underline @min-[56rem]:line-clamp-1">{p.name}</Link>
                              <RowPresence path={`${base}/${p.id}`} className="mt-0.5 flex" />
                              <p className="truncate text-xs text-muted-foreground">
                                <span className="@min-[36rem]:hidden">{p.isArchived ? "Archived · " : ""}</span>
                                {p.slug}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className={cn(td, "hidden @min-[36rem]:table-cell")}>
                          {p.isArchived ? (
                            <Badge variant="secondary">Archived</Badge>
                          ) : (
                            <Badge className="border-transparent bg-success/15 text-success hover:bg-success/15">Active</Badge>
                          )}
                        </td>
                        <td className={cn(td, "hidden whitespace-nowrap text-muted-foreground @min-[56rem]:table-cell")}>
                          {p.inventory == null ? "Not tracked" : `${number(p.inventory)} in stock`}
                        </td>
                        <td className={cn(td, "hidden tabular-nums text-muted-foreground @min-[48rem]:table-cell")}>{p.variantCount}</td>
                        <td className={cn(td, "hidden text-muted-foreground @min-[72rem]:table-cell")}>{p.brand || "—"}</td>
                        <td className={cn(td, "hidden whitespace-nowrap text-muted-foreground @min-[90rem]:table-cell")}>{relativeTime(p.updatedAt)}</td>
                        <td className={cn(td, "whitespace-nowrap text-right tabular-nums")}>{money(p.basePrice, currency)}</td>
                        <td className={td}>
                          <form action={toggleProductArchive}>
                            <input type="hidden" name="site" value={site.slug} />
                            <input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="archive" value={String(!p.isArchived)} />
                            <button
                              type="submit"
                              title={p.isArchived ? "Restore" : "Archive"}
                              className="grid size-8 place-items-center rounded-lg text-muted-foreground opacity-60 transition hover:bg-accent hover:text-foreground group-hover:opacity-100"
                            >
                              {p.isArchived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Pagination href={qs} page={result.page} perPage={result.perPage} total={result.total} />
        </Panel>
      )}
    </Page>
    </>
  );
}
