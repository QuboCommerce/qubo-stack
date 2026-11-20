import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
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
import { assetUrl } from "@/lib/format";

type Search = { q?: string; status?: string; page?: string };
const PER_PAGE = 50;

export default async function SalePricesPage({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<Search> }) {
  const [{ site: slug }, sp] = await Promise.all([params, searchParams]);
  const { site, siteId } = await requireSite(slug);
  const t = await getTranslations("promotions");
  const tc = await getTranslations("common");
  const format = await getFormatter();
  const money = (v: number | string) => format.number(Number(v), { style: "currency", currency });
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
    <Page title={t("title")} subtitle={t("sales.subtitle", { count: counts!.sale })} width="wide">
      <PromotionsTabs site={site.slug} active="sales" />

      <Panel title={t("sales.bulk.title")} description={t("sales.bulk.description")}>
        <ActionForm action={bulkSale} className="flex flex-wrap items-end gap-3" done={t("sales.bulk.done")}>
          <input type="hidden" name="site" value={site.slug} />
          <Field label={t("sales.bulk.category")} htmlFor="bulk-category" className="min-w-56 flex-1">
            <Select id="bulk-category" name="categoryId" defaultValue="">
              <option value="">{t("sales.bulk.anyCategory")}</option>
              {tree.map((c) => (
                <option key={c.id} value={c.id}>
                  {"\u00a0\u00a0".repeat(c.depth)}
                  {c.name} ({c.total})
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("sales.bulk.prefix")} htmlFor="bulk-prefix" className="w-56">
            <TextInput id="bulk-prefix" name="prefix" placeholder="JBM-" autoComplete="off" />
          </Field>
          <Field label={t("sales.bulk.discount")} htmlFor="bulk-percent" className="w-28">
            <div className="relative">
              <TextInput id="bulk-percent" name="percent" inputMode="decimal" placeholder="15" className="pr-7" />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
            </div>
          </Field>
          <div className="flex gap-2">
            <Button type="submit" name="mode" value="apply" className="group-data-[pending]:opacity-60">
              {t("sales.bulk.apply")}
            </Button>
            <Button type="submit" name="mode" value="end" variant="outline" className="group-data-[pending]:opacity-60">
              {t("sales.bulk.end")}
            </Button>
          </div>
        </ActionForm>
      </Panel>

      <Panel flush>
        <div className="@container">
          <IndexToolbar
            basePath={`/${site.slug}/promotions`}
            tabs={[
              { id: "sale", label: t("sales.tabs.sale"), count: counts!.sale },
              { id: "all", label: t("sales.tabs.all"), count: counts!.all },
            ]}
            active={status}
            q={q}
            placeholder={t("sales.searchPlaceholder")}
          />
        </div>
        {rows.length === 0 ? (
          <EmptyState
            icon={BadgePercent}
            title={status === "sale" ? t("sales.empty.saleTitle") : t("sales.empty.searchTitle")}
            description={status === "sale" ? t("sales.empty.saleDescription") : t("sales.empty.searchDescription")}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className={th}>{t("sales.table.product")}</th>
                  <th className={th}>{t("sales.table.regularPrice")}</th>
                  <th className={th}>{t("sales.table.salePrice")}</th>
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
                      <td className={`${td} tabular-nums ${sale ? "text-muted-foreground line-through" : ""}`}>{money(regular)}</td>
                      <td className={td}>
                        <ActionForm action={setSalePrice} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="site" value={site.slug} />
                          <input type="hidden" name="productId" value={p.id} />
                          <TextInput
                            name="salePrice"
                            inputMode="decimal"
                            defaultValue={sale ? p.basePrice : ""}
                            placeholder={t("sales.notOnSale")}
                            aria-label={t("sales.salePriceFor", { name: p.name })}
                            className="h-8 w-32 tabular-nums"
                          />
                          <Button type="submit" size="sm" variant="outline">
                            {tc("save")}
                          </Button>
                          {pct ? <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">{t("sales.percentOff", { percent: pct })}</span> : null}
                        </ActionForm>
                      </td>
                      <td className={`${td} text-right`}>
                        {sale ? (
                          <ActionForm action={setSalePrice} done={t("sales.ended")}>
                            <input type="hidden" name="site" value={site.slug} />
                            <input type="hidden" name="productId" value={p.id} />
                            <input type="hidden" name="salePrice" value="" />
                            <Button type="submit" size="sm" variant="ghost">
                              {t("sales.endSale")}
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
