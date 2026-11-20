import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { ExternalLink, Info, Layers, Plus, TriangleAlert } from "lucide-react";
import { db } from "@qubo/db/client";
import { collection } from "@qubo/db/schema";
import { asc, eq } from "drizzle-orm";
import { td, th } from "@/components/index-table";
import { LiveRefresh } from "@/components/live-events";
import { EmptyState, Page, Panel } from "@/components/page";
import { ProductThumb } from "@/components/products/product-thumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireSite } from "@/lib/admin";
import { getCategoryTree } from "@/lib/categories";
import { describeRules } from "@/lib/collection-summary";
import { collectionCounts, pickedIds } from "@/lib/collections";
import { assetUrl } from "@/lib/format";

export async function generateMetadata() {
  const t = await getTranslations("collections");
  return { title: t("title") };
}

export default async function CollectionsPage({ params }: { params: Promise<{ site: string }> }) {
  const { site: slug } = await params;
  const { site, siteId, user } = await requireSite(slug);
  const [t, format, locale, rows, tree] = await Promise.all([
    getTranslations("collections"),
    getFormatter(),
    getLocale(),
    db.select().from(collection).where(eq(collection.siteId, siteId)).orderBy(asc(collection.position), asc(collection.name)),
    getCategoryTree(siteId),
  ]);
  const [counts, picks] = await Promise.all([
    collectionCounts(siteId, rows),
    Promise.all(rows.filter((c) => c.kind === "manual").map(async (c) => [c.id, (await pickedIds(c.id)).length] as const)).then((e) => new Map(e)),
  ]);
  const currency = site.currency ?? "EUR";
  const categories = new Map(tree.map((c) => [c.id, c.name]));
  const categorySlugs = new Set(tree.map((c) => c.slug));
  const base = `/${site.slug}/products/collections`;

  const summary = (c: (typeof rows)[number]) =>
    c.kind === "manual"
      ? t("summary.manual", { count: picks.get(c.id) ?? 0 })
      : (describeRules(c.rules, c.match, {
          locale,
          phrase: (key, values) => t(`rules.phrases.${key}`, values),
          categoryName: (id) => categories.get(id) ?? t("rules.deletedCategory"),
          money: (v) => format.number(v, { style: "currency", currency }),
        }) ?? t("summary.noRules"));

  const create = (
    <Button size="sm" asChild>
      <Link href={`${base}/new`}>
        <Plus /> {t("list.create")}
      </Link>
    </Button>
  );

  return (
    <>
      <LiveRefresh siteId={siteId} userId={user.id} tables={["collection"]} />
      <Page title={t("title")} subtitle={rows.length ? t("list.subtitle", { count: rows.length }) : undefined} width="wide" actions={rows.length ? create : undefined}>
        <Panel flush>
          {rows.length === 0 ? (
            <EmptyState icon={Layers} title={t("list.empty.title")} description={t("list.empty.description")} action={create} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30">
                  <tr>
                    <th className={th}>{t("list.columns.collection")}</th>
                    <th className={`${th} text-right`}>{t("list.columns.products")}</th>
                    <th className={th}>{t("list.columns.status")}</th>
                    <th className={th}>
                      <span className="sr-only">{t("list.viewOnSite")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((c) => {
                    const hidden = categorySlugs.has(c.slug);
                    return (
                      <tr key={c.id} className="hover:bg-accent/30">
                        <td className={td}>
                          <Link href={`${base}/${c.id}`} className="group flex min-w-0 items-center gap-3">
                            <div className="size-11 shrink-0 overflow-hidden rounded-lg border bg-gradient-to-br from-muted to-muted/30">
                              {c.image ? (
                                <ProductThumb src={assetUrl(c.image)} alt={c.name} className="object-cover" />
                              ) : (
                                <div className="grid size-full place-items-center text-muted-foreground/70">
                                  <Layers className="size-4" strokeWidth={1.5} />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium group-hover:underline">{c.name}</p>
                              <p className="line-clamp-1 max-w-xl text-xs text-muted-foreground">{summary(c)}</p>
                              {hidden && (
                                <p className="mt-0.5 flex items-center gap-1 text-xs text-warning" title={t("list.hiddenByCategoryHint", { slug: c.slug })}>
                                  <TriangleAlert className="size-3" /> {t("list.hiddenByCategory")}
                                </p>
                              )}
                            </div>
                          </Link>
                        </td>
                        <td className={`${td} whitespace-nowrap text-right tabular-nums text-muted-foreground`}>
                          {t("list.productCount", { count: counts.get(c.id) ?? 0 })}
                        </td>
                        <td className={td}>
                          {c.isPublished ? (
                            <Badge className="border-transparent bg-success/15 text-success">{t("status.published")}</Badge>
                          ) : (
                            <Badge variant="secondary">{t("status.draft")}</Badge>
                          )}
                        </td>
                        <td className={`${td} text-right`}>
                          {c.isPublished && site.url && !hidden && (
                            <Button variant="ghost" size="icon-sm" asChild>
                              <a href={`${site.url}/collections/${c.slug}`} target="_blank" rel="noreferrer" aria-label={t("list.viewOnSite")} title={t("list.viewOnSite")}>
                                <ExternalLink />
                              </a>
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <aside className="flex gap-3 px-3 text-[13px] text-muted-foreground xs:px-1">
          <Info className="mt-0.5 size-4 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">{t("list.notes.title")}</p>
            <p>
              {t.rich("list.notes.categories", {
                link: (chunks) => (
                  <Link href={`/${site.slug}/products/categories`} className="font-medium text-foreground underline-offset-2 hover:underline">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
            <p>{t("list.notes.promotions")}</p>
          </div>
        </aside>
      </Page>
    </>
  );
}
