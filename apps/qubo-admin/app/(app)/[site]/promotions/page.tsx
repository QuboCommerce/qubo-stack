import { notFound } from "next/navigation";
import { BadgePercent } from "lucide-react";
import { db } from "@qubo/db/client";
import { product, productImage } from "@qubo/db/schema";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { bulkSale, setSalePrice } from "@/app/promotion-actions";
import { IndexToolbar, Pagination, td, th } from "@/components/index-table";
import { EmptyState, Page, Panel } from "@/components/page";
import { ProductThumb } from "@/components/products/product-thumb";
import { ActionForm } from "@/components/promotions/action-form";
import { PromotionsTabs } from "@/components/promotions/promotions-tabs";
import { Field, Select, TextInput } from "@/components/settings/controls";
import { Button } from "@/components/ui/button";
import { requireSite } from "@/lib/admin";
import { getCategoryTree } from "@/lib/categories";
import { assetUrl, money, number } from "@/lib/format";

type Search = { q?: string; status?: string; page?: string };
const PER_PAGE = 50;

export default async function SalePricesPage({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<Search> }) {
  const [{ site: slug }, sp] = await Promise.all([params, searchParams]);
  const { site, siteId } = await requireSite(slug);
  if (!(site.capabilities ?? []).includes("commerce")) notFound();
  const status = sp.status === "all" ? "all" : "sale";
  const q = sp.q?.trim() ?? "";
  const page = Math.max(1, Number(sp.page) || 1);
  const currency = site.currency ?? "EUR";

  const reference = sql<string | null>`coalesce(${product.sourceSnapshot}->>'Référence', ${product.legacyId})`;
  const onSale = sql`${product.compareAtPrice} > ${product.basePrice}`;
  const base = and(eq(product.siteId, siteId), eq(product.isArchived, false));
  const term = q ? `%${q.replaceAll("%", "\\%").replaceAll("_", "\\_")}%` : null;
  const matches = term ? or(ilike(product.name, term), sql`${reference} ilike ${term}`) : undefined;
  const shownFilter = and(status === "sale" ? onSale : undefined, matches);

  const [rows, [counts], tree] = await Promise.all([
    db
      .select({
        id: product.id,
        name: product.name,
        basePrice: product.basePrice,
        compareAtPrice: product.compareAtPrice,
        reference,
        image: sql<string | null>`(select ${productImage.url} from ${productImage} where ${productImage.productId} = ${product.id} order by ${productImage.position} limit 1)`,
      })
      .from(product)
      .where(and(base, shownFilter))
      .orderBy(asc(product.name))
      .limit(PER_PAGE)
      .offset((page - 1) * PER_PAGE),
    db
      .select({
        sale: sql<number>`count(*) filter (where ${onSale})::int`,
        all: sql<number>`count(*)::int`,
        shown: shownFilter ? sql<number>`count(*) filter (where ${shownFilter})::int` : sql<number>`count(*)::int`,
      })
      .from(product)
      .where(base),
    getCategoryTree(siteId),
  ]);
  const href = (p: number) => `/${site.slug}/promotions?status=${status}${q ? `&q=${encodeURIComponent(q)}` : ""}&page=${p}`;

  return (
    <Page title="Promotions" subtitle={`${number(counts!.sale)} ${counts!.sale === 1 ? "product" : "products"} on sale`} width="wide">
      <PromotionsTabs site={site.slug} active="sales" />

      <Panel title="Put a selection on sale" description="Lowers the price by a percentage. The current price becomes the struck-through price, so ending the sale restores it.">
        <ActionForm action={bulkSale} className="flex flex-wrap items-end gap-3" done="Prices updated">
          <input type="hidden" name="site" value={site.slug} />
          <Field label="Category" htmlFor="bulk-category" className="min-w-56 flex-1">
            <Select id="bulk-category" name="categoryId" defaultValue="">
              <option value="">Any category</option>
              {tree.map((c) => (
                <option key={c.id} value={c.id}>
                  {"\u00a0\u00a0".repeat(c.depth)}
                  {c.name} ({c.total})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reference or name starts with" htmlFor="bulk-prefix" className="w-56">
            <TextInput id="bulk-prefix" name="prefix" placeholder="JBM-" autoComplete="off" />
          </Field>
          <Field label="Discount" htmlFor="bulk-percent" className="w-28">
            <div className="relative">
              <TextInput id="bulk-percent" name="percent" inputMode="decimal" placeholder="15" className="pr-7" />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
            </div>
          </Field>
          <div className="flex gap-2">
            <Button type="submit" name="mode" value="apply" className="group-data-[pending]:opacity-60">
              Apply discount
            </Button>
            <Button type="submit" name="mode" value="end" variant="outline" className="group-data-[pending]:opacity-60">
              End sale
            </Button>
          </div>
        </ActionForm>
      </Panel>

      <Panel flush>
        <div className="@container">
          <IndexToolbar
            basePath={`/${site.slug}/promotions`}
            tabs={[
              { id: "sale", label: "On sale", count: counts!.sale },
              { id: "all", label: "All products", count: counts!.all },
            ]}
            active={status}
            q={q}
            placeholder="Search name or reference"
          />
        </div>
        {rows.length === 0 ? (
          <EmptyState
            icon={BadgePercent}
            title={status === "sale" ? "Nothing is on sale" : "No products match"}
            description={status === "sale" ? "Use the form above, or open All products and type a sale price next to a product." : "Try another name or reference."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className={th}>Product</th>
                  <th className={th}>Regular price</th>
                  <th className={th}>Sale price</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((p) => {
                  const sale = p.compareAtPrice !== null && Number(p.compareAtPrice) > Number(p.basePrice);
                  const regular = sale ? p.compareAtPrice! : p.basePrice;
                  const pct = sale ? Math.round((1 - Number(p.basePrice) / Number(regular)) * 100) : null;
                  return (
                    <tr key={p.id}>
                      <td className={td}>
                        <div className="flex items-center gap-3">
                          <div className="size-10 shrink-0 overflow-hidden rounded-md border bg-card">
                            <ProductThumb src={assetUrl(p.image)} alt="" />
                          </div>
                          <div className="min-w-0">
                            <a href={`/${site.slug}/products/${p.id}`} className="block truncate font-medium hover:underline">
                              {p.name}
                            </a>
                            {p.reference && <span className="block text-xs text-muted-foreground">{p.reference}</span>}
                          </div>
                        </div>
                      </td>
                      <td className={`${td} tabular-nums ${sale ? "text-muted-foreground line-through" : ""}`}>{money(regular, currency)}</td>
                      <td className={td}>
                        <ActionForm action={setSalePrice} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="site" value={site.slug} />
                          <input type="hidden" name="productId" value={p.id} />
                          <TextInput
                            name="salePrice"
                            inputMode="decimal"
                            defaultValue={sale ? p.basePrice : ""}
                            placeholder="Not on sale"
                            aria-label={`Sale price for ${p.name}`}
                            className="h-8 w-32 tabular-nums"
                          />
                          <Button type="submit" size="sm" variant="outline">
                            Save
                          </Button>
                          {pct ? <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">−{pct}%</span> : null}
                        </ActionForm>
                      </td>
                      <td className={`${td} text-right`}>
                        {sale ? (
                          <ActionForm action={setSalePrice} done="Ended">
                            <input type="hidden" name="site" value={site.slug} />
                            <input type="hidden" name="productId" value={p.id} />
                            <input type="hidden" name="salePrice" value="" />
                            <Button type="submit" size="sm" variant="ghost">
                              End sale
                            </Button>
                          </ActionForm>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination href={href} page={page} perPage={PER_PAGE} total={counts!.shown} />
      </Panel>
    </Page>
  );
}
