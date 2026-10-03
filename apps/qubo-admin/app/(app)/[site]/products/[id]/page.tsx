import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageOff } from "lucide-react";
import { db } from "@qubo/db/client";
import { product, productCategory, productImage, productVariant } from "@qubo/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { saveProduct } from "@/app/product-actions";
import { CategoryTree } from "@/components/categories/category-tree";
import { Page } from "@/components/page";
import { Field, Select, SwitchRow, TextArea, TextInput } from "@/components/settings/controls";
import { SettingsForm } from "@/components/settings/settings-form";
import { Surface } from "@/components/settings/settings-group";
import { Badge } from "@/components/ui/badge";
import { requireSite } from "@/lib/admin";
import { getCategoryTree } from "@/lib/categories";
import { productValues } from "@/lib/form-specs";
import { assetUrl, money, relativeTime } from "@/lib/format";

const uuid = /^[0-9a-f-]{36}$/i;

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Surface className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </Surface>
  );
}

export default async function ProductPage({ params }: { params: Promise<{ site: string; id: string }> }) {
  const { site: slug, id } = await params;
  const { site, siteId } = await requireSite(slug);
  const isNew = id === "new";
  if (!isNew && !uuid.test(id)) notFound();

  const [row] = isNew
    ? [null]
    : await db.select().from(product).where(and(eq(product.id, id), eq(product.siteId, siteId))).limit(1);
  if (!isNew && !row) notFound();
  const [images, variants, links, tree] = isNew
    ? [[], [], [], await getCategoryTree(siteId)]
    : await Promise.all([
        db.select().from(productImage).where(eq(productImage.productId, id)).orderBy(asc(productImage.position)),
        db.select().from(productVariant).where(eq(productVariant.productId, id)).orderBy(asc(productVariant.position)),
        db.select({ id: productCategory.categoryId }).from(productCategory).where(eq(productCategory.productId, id)),
        getCategoryTree(siteId),
      ]);
  const order = new Map(tree.map((n, i) => [n.id, i]));
  const linked = links.map((l) => l.id).sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  const currency = site.currency ?? "EUR";
  const p = row;

  return (
    <Page
      title={p?.name ?? "Add product"}
      backHref={`/${site.slug}/products`}
      width="wide"
      badge={p ? (p.isArchived ? <Badge variant="secondary">Archived</Badge> : <Badge className="border-transparent bg-success/15 text-success">Active</Badge>) : undefined}
    >
      <SettingsForm
        action={saveProduct}
        className="@container"
        noun="product"
        base={p ? productValues(p, linked) : undefined}
        watch={p ? { table: "product", id: p.id } : undefined}
      >
        <input type="hidden" name="site" value={site.slug} />
        <input type="hidden" name="id" value={id} />
        <div className="grid items-start gap-4 @min-[64rem]:grid-cols-[minmax(0,1fr)_20rem] @min-[96rem]:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="min-w-0 space-y-4">
            <Card title="Details">
              <Field label="Title" htmlFor="name">
                <TextInput id="name" name="name" defaultValue={p?.name ?? ""} required minLength={2} maxLength={255} placeholder="e.g. Armoire réfrigérée positive 700 L" />
              </Field>
              <Field label="Description" htmlFor="description" hint="Plain text for now. Line breaks are kept.">
                <TextArea id="description" name="description" defaultValue={p?.description ?? ""} rows={8} />
              </Field>
            </Card>

            <Card title="Media" description={images.length ? `${images.length} image${images.length > 1 ? "s" : ""}` : "Uploads arrive with the media library."}>
              {images.length ? (
                <ul className="grid grid-cols-3 gap-2 @min-[40rem]:grid-cols-5 @min-[80rem]:grid-cols-7">
                  {images.map((img, i) => (
                    <li key={img.id} className={i === 0 ? "col-span-2 row-span-2" : undefined}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={assetUrl(img.url) ?? ""} alt={img.alt ?? ""} className="aspect-square size-full rounded-lg border bg-white object-contain p-1" />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="grid h-28 place-items-center rounded-lg border border-dashed text-muted-foreground"><ImageOff className="size-5" /></div>
              )}
            </Card>

            <Card title="Pricing">
              <div className="grid gap-4 @min-[36rem]:grid-cols-2">
                <Field label={`Price (${currency})`} htmlFor="basePrice">
                  <TextInput id="basePrice" name="basePrice" inputMode="decimal" defaultValue={p?.basePrice ?? ""} required placeholder="0.00" />
                </Field>
                <Field label="Compare-at price" htmlFor="compareAtPrice" hint="Shown struck through when higher than the price.">
                  <TextInput id="compareAtPrice" name="compareAtPrice" inputMode="decimal" defaultValue={p?.compareAtPrice ?? ""} placeholder="0.00" />
                </Field>
              </div>
            </Card>

            {variants.length > 0 && (
              <Surface flush>
                <div className="px-4 pt-4 pb-2"><h2 className="text-sm font-semibold">Variants</h2><p className="text-xs text-muted-foreground">Variant editing comes with the variant builder.</p></div>
                <div className="overflow-x-auto border-t">
                  <table className="w-full text-[13px]">
                    <thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-2 font-medium">Variant</th><th className="px-4 py-2 font-medium">SKU</th><th className="px-4 py-2 text-right font-medium">Price</th></tr></thead>
                    <tbody className="divide-y">
                      {variants.map((v) => (
                        <tr key={v.id}><td className="px-4 py-2">{v.name}</td><td className="px-4 py-2 font-mono text-xs text-muted-foreground">{v.sku ?? "—"}</td><td className="px-4 py-2 text-right tabular-nums">{money(v.price ?? p!.basePrice, currency)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Surface>
            )}

            <Card title="Shipping" description="Weight in kg, dimensions in cm.">
              <div className="grid grid-cols-2 gap-4 @min-[48rem]:grid-cols-4">
                {(["weight", "width", "height", "depth"] as const).map((k) => (
                  <Field key={k} label={{ weight: "Weight", width: "Width", height: "Height", depth: "Depth" }[k]} htmlFor={k}>
                    <TextInput id={k} name={k} inputMode="decimal" defaultValue={p?.[k] ?? ""} />
                  </Field>
                ))}
              </div>
            </Card>

            <Card title="Search engine listing">
              <Field label="Handle" htmlFor="slug" hint={`/products/${p?.slug ?? "…"} · Leave empty to generate it from the title.`}>
                <TextInput id="slug" name="slug" defaultValue={p?.slug ?? ""} className="font-mono" />
              </Field>
              <Field label="Page title" htmlFor="metaTitle">
                <TextInput id="metaTitle" name="metaTitle" defaultValue={p?.metaTitle ?? ""} maxLength={120} placeholder={p?.name} />
              </Field>
              <Field label="Meta description" htmlFor="metaDescription">
                <TextArea id="metaDescription" name="metaDescription" defaultValue={p?.metaDescription ?? ""} maxLength={320} rows={3} />
              </Field>
            </Card>
          </div>

          <div className="space-y-4 @min-[64rem]:sticky @min-[64rem]:top-4">
            <Card title="Status">
              <Select name="status" defaultValue={p?.isArchived ? "archived" : "active"} aria-label="Status">
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </Select>
            </Card>
            <Surface flush>
              <SwitchRow name="isFeatured" defaultChecked={p?.isFeatured ?? false} label="Featured" description="Highlighted in featured product sections." />
            </Surface>
            <Card title="Organisation">
              <Field label="Brand" htmlFor="brand">
                <TextInput id="brand" name="brand" defaultValue={p?.brand ?? ""} />
              </Field>
              <div className="space-y-2">
                <p className="flex items-baseline justify-between text-[13px] font-medium">
                  Categories
                  <Link href={`/${site.slug}/products/categories`} className="text-xs font-normal text-muted-foreground hover:text-foreground">Manage</Link>
                </p>
                {tree.length ? (
                  <CategoryTree
                    mode="select"
                    name="categoryIds"
                    items={tree.map(({ id, name, parentId, depth, total, childCount }) => ({ id, name, parentId, depth, total, childCount }))}
                    defaultSelected={linked}
                    className="max-h-80"
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">No categories yet.</p>
                )}
              </div>
            </Card>
            {p && (
              <p className="px-1 text-xs text-muted-foreground">
                Updated {relativeTime(p.updatedAt)}{p.legacyId ? ` · Legacy #${p.legacyId}` : ""}
              </p>
            )}
          </div>
        </div>
      </SettingsForm>
    </Page>
  );
}
