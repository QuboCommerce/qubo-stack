import Link from "next/link";
import { ArrowDown, ArrowUp, FolderTree, ImageOff, Plus } from "lucide-react";
import { db } from "@qubo/db/client";
import { category, product, productCategory, productImage } from "@qubo/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import { createCategory, moveCategory, saveCategory } from "@/app/category-actions";
import { CategoryTree } from "@/components/categories/category-tree";
import { DeleteCategoryButton } from "@/components/categories/delete-category-button";
import { EmptyState, Page, Panel } from "@/components/page";
import { Field, Select, TextArea, TextInput } from "@/components/settings/controls";
import { SettingsForm } from "@/components/settings/settings-form";
import { Surface } from "@/components/settings/settings-group";
import { Button } from "@/components/ui/button";
import { requireSite } from "@/lib/admin";
import { getCategoryTree, subtreeIds } from "@/lib/categories";
import { assetUrl, money, number } from "@/lib/format";
import { getCatalogHealth } from "@/lib/queries";

const uuid = /^[0-9a-f-]{36}$/i;

function AddButton({ site, parentId, label, variant = "outline" }: { site: string; parentId?: string; label: string; variant?: "outline" | "default" }) {
  return (
    <form action={createCategory}>
      <input type="hidden" name="site" value={site} />
      <input type="hidden" name="parentId" value={parentId ?? ""} />
      <Button type="submit" size="sm" variant={variant}><Plus /> {label}</Button>
    </form>
  );
}

function MoveButton({ site, id, direction, disabled }: { site: string; id: string; direction: "up" | "down"; disabled: boolean }) {
  const Icon = direction === "up" ? ArrowUp : ArrowDown;
  const label = direction === "up" ? "Move up" : "Move down";
  return (
    <form action={moveCategory}>
      <input type="hidden" name="site" value={site} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="direction" value={direction} />
      <Button type="submit" size="icon" variant="ghost" className="size-8" disabled={disabled} title={label} aria-label={label}>
        <Icon />
      </Button>
    </form>
  );
}

export default async function CategoriesPage({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ id?: string }> }) {
  const [{ site: slug }, sp] = await Promise.all([params, searchParams]);
  const { site, siteId } = await requireSite(slug);
  const [tree, health] = await Promise.all([getCategoryTree(siteId), getCatalogHealth(siteId)]);
  const base = `/${site.slug}/products/categories`;
  const selected = sp.id && uuid.test(sp.id) ? tree.find((n) => n.id === sp.id) : undefined;
  const items = tree.map(({ id, name, parentId, depth, total, childCount }) => ({ id, name, parentId, depth, total, childCount }));
  const uncategorised = health.total - health.categorized;

  const [detail] = selected
    ? await db.select({ description: category.description, legacyPath: category.legacyPath }).from(category).where(and(eq(category.id, selected.id), eq(category.siteId, siteId))).limit(1)
    : [];
  const products = selected
    ? await db
        .select({
          id: product.id,
          name: product.name,
          basePrice: product.basePrice,
          isArchived: product.isArchived,
          image: sql<string | null>`(select ${productImage.url} from ${productImage} where ${productImage.productId} = ${product.id} order by ${productImage.position} limit 1)`,
        })
        .from(productCategory)
        .innerJoin(product, eq(product.id, productCategory.productId))
        .where(eq(productCategory.categoryId, selected.id))
        .orderBy(asc(product.name))
        .limit(12)
    : [];

  const siblings = selected ? tree.filter((n) => n.parentId === selected.parentId) : [];
  const index = selected ? siblings.findIndex((n) => n.id === selected.id) : -1;
  const byId = new Map(tree.map((n) => [n.id, n]));
  const parent = selected?.parentId ? byId.get(selected.parentId) : undefined;
  const blocked = selected ? subtreeIds(tree, selected.id) : new Set<string>();
  const crumbs: { id: string; name: string }[] = [];
  for (let n = parent; n; n = n.parentId ? byId.get(n.parentId) : undefined) crumbs.unshift(n);
  const currency = site.currency ?? "EUR";

  return (
    <Page
      title="Categories"
      subtitle={tree.length ? `${number(tree.length)} categories · ${number(uncategorised)} products without one` : undefined}
      backHref={`/${site.slug}/products`}
      width="wide"
      actions={<AddButton site={site.slug} label="Add category" variant="default" />}
    >
      {tree.length === 0 ? (
        <Panel>
          <EmptyState icon={FolderTree} title="Organise your catalogue" description="Categories group products on your storefront and in navigation menus." />
        </Panel>
      ) : (
        <div className="@container">
          <div className="grid items-start gap-4 @min-[56rem]:grid-cols-[20rem_minmax(0,1fr)] @min-[96rem]:grid-cols-[24rem_minmax(0,1fr)]">
            <Panel bodyClassName="p-2 sm:p-3" className="@min-[56rem]:sticky @min-[56rem]:top-4">
              <CategoryTree mode="link" items={items} hrefBase={base} selectedId={selected?.id} className="max-h-[40vh] @min-[56rem]:max-h-[calc(100dvh-12rem)]" />
            </Panel>

            {!selected ? (
              <Panel>
                <EmptyState
                  icon={FolderTree}
                  title="Pick a category to edit it"
                  description={
                    uncategorised > 0
                      ? `${number(uncategorised)} products don't have a category yet. Open one and tick a category under Organisation.`
                      : "Rename, move or reorder categories, and see the products inside each one."
                  }
                  action={
                    uncategorised > 0 ? (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/${site.slug}/products?category=none`}>Show uncategorised products</Link>
                      </Button>
                    ) : undefined
                  }
                />
              </Panel>
            ) : (
              <div className="min-w-0 space-y-4">
                <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 px-4 text-xs text-muted-foreground sm:px-1">
                  <Link href={base} className="hover:text-foreground">All categories</Link>
                  {crumbs.map((c) => (
                    <span key={c.id} className="flex items-center gap-1">
                      <span aria-hidden>›</span>
                      <Link href={`${base}?id=${c.id}`} className="hover:text-foreground">{c.name}</Link>
                    </span>
                  ))}
                  <span aria-hidden>›</span>
                  <span className="font-medium text-foreground">{selected.name}</span>
                </nav>

                <SettingsForm key={selected.id} action={saveCategory}>
                  <input type="hidden" name="site" value={site.slug} />
                  <input type="hidden" name="id" value={selected.id} />
                  <Surface className="space-y-4">
                    <Field label="Name" htmlFor="name">
                      <TextInput id="name" name="name" defaultValue={selected.name} required maxLength={120} />
                    </Field>
                    <Field label="Description" htmlFor="description" hint="Shown at the top of the category page on the storefront.">
                      <TextArea id="description" name="description" defaultValue={detail?.description ?? ""} rows={4} />
                    </Field>
                    <div className="grid gap-4 @min-[40rem]:grid-cols-2">
                      <Field label="Parent category" htmlFor="parentId">
                        <Select id="parentId" name="parentId" defaultValue={selected.parentId ?? ""}>
                          <option value="">None (top level)</option>
                          {tree.map((n) => (
                            <option key={n.id} value={n.id} disabled={blocked.has(n.id)}>
                              {"\u00a0\u00a0\u00a0".repeat(n.depth)}{n.name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Handle" htmlFor="slug" hint={`/collections/${selected.slug}`}>
                        <TextInput id="slug" name="slug" defaultValue={selected.slug} className="font-mono" />
                      </Field>
                    </div>
                  </Surface>
                </SettingsForm>

                <Surface className="flex flex-wrap items-center gap-2">
                  <AddButton site={site.slug} parentId={selected.id} label="Add subcategory" />
                  <div className="flex items-center rounded-lg border">
                    <MoveButton site={site.slug} id={selected.id} direction="up" disabled={index <= 0} />
                    <MoveButton site={site.slug} id={selected.id} direction="down" disabled={index < 0 || index >= siblings.length - 1} />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {index + 1} of {siblings.length} in {parent ? `“${parent.name}”` : "the top level"}
                  </span>
                  <div className="ml-auto">
                    <DeleteCategoryButton
                      site={site.slug}
                      id={selected.id}
                      name={selected.name}
                      childCount={selected.childCount}
                      productCount={selected.direct}
                      parentName={parent?.name ?? null}
                    />
                  </div>
                </Surface>

                <Panel
                  flush
                  title="Products"
                  description={
                    selected.total === selected.direct
                      ? `${number(selected.direct)} in this category`
                      : `${number(selected.direct)} directly here · ${number(selected.total)} including subcategories`
                  }
                  action={
                    selected.total > 0 ? (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/${site.slug}/products?category=${selected.id}`}>View all</Link>
                      </Button>
                    ) : undefined
                  }
                >
                  {products.length === 0 ? (
                    <p className="px-4 pb-5 text-[13px] text-muted-foreground sm:px-5">
                      {selected.total > 0 ? "Products are in its subcategories." : "No products yet. Add them from a product's Organisation card."}
                    </p>
                  ) : (
                    <ul className="divide-y border-t">
                      {products.map((p) => {
                        const img = assetUrl(p.image);
                        return (
                          <li key={p.id}>
                            <Link href={`/${site.slug}/products/${p.id}`} className="flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors hover:bg-accent/40 sm:px-5">
                              <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-md border bg-white">
                                {img ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={img} alt="" loading="lazy" className="size-full object-contain" />
                                ) : (
                                  <ImageOff className="size-4 text-muted-foreground" />
                                )}
                              </span>
                              <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                              {p.isArchived && <span className="text-xs text-muted-foreground">Archived</span>}
                              <span className="tabular-nums text-muted-foreground">{money(p.basePrice, currency)}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Panel>
                {detail?.legacyPath && <p className="px-4 text-xs text-muted-foreground sm:px-1">Imported from ShopApplication #{detail.legacyPath.split("/").at(-1)}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </Page>
  );
}
