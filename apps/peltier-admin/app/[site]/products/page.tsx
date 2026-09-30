import { Archive, ArchiveRestore, ImageOff, Package, Plus, Upload } from "lucide-react";
import { toggleProductArchive } from "@/app/actions";
import { IndexToolbar, Pagination, td, th } from "@/components/index-table";
import { EmptyState, Page, Panel } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireSite } from "@/lib/admin";
import { assetUrl, money, number, relativeTime } from "@/lib/format";
import { getCatalogHealth, getProducts } from "@/lib/queries";
import { cn } from "@peltier/shared/utils";

type Search = { q?: string; status?: string; page?: string };

export default async function ProductsPage({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<Search> }) {
  const [{ site: slug }, sp] = await Promise.all([params, searchParams]);
  const { site, siteId } = await requireSite(slug);
  const status = sp.status === "active" || sp.status === "archived" ? sp.status : "all";
  const page = Number(sp.page) || 1;
  const [result, health] = await Promise.all([
    getProducts(siteId, { q: sp.q, status, page }),
    getCatalogHealth(siteId),
  ]);
  const base = `/${site.slug}/products`;
  const qs = (p: number) => `${base}?status=${status}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}&page=${p}`;
  const currency = site.currency ?? "EUR";

  return (
    <Page
      title="Products"
      width="wide"
      actions={
        <>
          <Button variant="outline" size="sm" className="flex-1 xs:flex-none"><Upload /> Import</Button>
          <Button size="sm" className="flex-1 xs:flex-none"><Plus /> Add product</Button>
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
            tabs={[
              { id: "all", label: "All", count: health.total },
              { id: "active", label: "Active", count: health.active },
              { id: "archived", label: "Archived", count: health.total - health.active },
            ]}
          />
          {result.rows.length === 0 ? (
            <EmptyState icon={Package} title="No products found" description="Try changing the filters or search term." />
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
                              <p className="line-clamp-2 font-medium @min-[56rem]:line-clamp-1">{p.name}</p>
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
  );
}
