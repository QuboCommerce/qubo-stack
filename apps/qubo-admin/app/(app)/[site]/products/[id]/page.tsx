import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageOff } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { db } from "@qubo/db/client";
import { product, productCategory, productImage, productVariant, productVariantImage } from "@qubo/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { saveProduct } from "@/app/product-actions";
import { CategoryTree } from "@/components/categories/category-tree";
import { Page } from "@/components/page";
import { ProductMedia } from "@/components/products/product-media";
import { VariantImages } from "@/components/products/variant-images";
import { Field, Select, SwitchRow, TextArea, TextInput } from "@/components/settings/controls";
import { SettingsForm } from "@/components/settings/settings-form";
import { Surface } from "@/components/settings/settings-group";
import { Badge } from "@/components/ui/badge";
import { requireSite } from "@/lib/admin";
import { getCategoryTree } from "@/lib/categories";
import { productValues } from "@/lib/form-specs";
import { assetUrl } from "@/lib/format";

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
  const [t, ts, format] = await Promise.all([
    getTranslations("products.form"),
    getTranslations("products.status"),
    getFormatter(),
  ]);
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
  const money = (v: number | string) => format.number(Number(v), { style: "currency", currency });
  const p = row;
  const variantLinks = variants.length
    ? await db.select().from(productVariantImage).where(inArray(productVariantImage.variantId, variants.map((v) => v.id)))
    : [];
  const gallery = images.map((img) => ({ id: img.id, src: assetUrl(img.url) ?? img.url, alt: img.alt ?? "" }));

  return (
    <Page
      title={p?.name ?? t("addTitle")}
      backHref={`/${site.slug}/products`}
      width="wide"
      badge={p ? (p.isArchived ? <Badge variant="secondary">{ts("archived")}</Badge> : <Badge className="border-transparent bg-success/15 text-success">{ts("active")}</Badge>) : undefined}
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
            <Card title={t("cards.details")}>
              <Field label={t("fields.title")} htmlFor="name">
                <TextInput id="name" name="name" defaultValue={p?.name ?? ""} required minLength={2} maxLength={255} placeholder={t("fields.titlePlaceholder")} />
              </Field>
              <Field label={t("fields.description")} htmlFor="description" hint={t("fields.descriptionHint")}>
                <TextArea id="description" name="description" defaultValue={p?.description ?? ""} rows={8} />
              </Field>
            </Card>

            <Card title={t("cards.media")} description={isNew ? t("mediaNew") : t("mediaHint")}>
              {isNew ? (
                <div className="grid h-28 place-items-center rounded-lg border border-dashed text-muted-foreground"><ImageOff className="size-5" /></div>
              ) : (
                <ProductMedia
                  site={site.slug}
                  siteId={siteId}
                  productId={id}
                  initial={images.map((img) => ({ url: img.url, alt: img.alt ?? "", src: assetUrl(img.url) ?? img.url }))}
                />
              )}
            </Card>

            <Card title={t("cards.pricing")}>
              <div className="grid gap-4 @min-[36rem]:grid-cols-2">
                <Field label={t("fields.price", { currency })} htmlFor="basePrice">
                  <TextInput id="basePrice" name="basePrice" inputMode="decimal" defaultValue={p?.basePrice ?? ""} required placeholder="0.00" />
                </Field>
                <Field label={t("fields.compareAt")} htmlFor="compareAtPrice" hint={t("fields.compareAtHint")}>
                  <TextInput id="compareAtPrice" name="compareAtPrice" inputMode="decimal" defaultValue={p?.compareAtPrice ?? ""} placeholder="0.00" />
                </Field>
              </div>
            </Card>

            {variants.length > 0 && (
              <Surface flush>
                <div className="px-4 pt-4 pb-2"><h2 className="text-sm font-semibold">{t("cards.variants")}</h2><p className="text-xs text-muted-foreground">{t("variantsHint")}</p></div>
                <div className="overflow-x-auto border-t">
                  <table className="w-full text-[13px]">
                    <thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-2 font-medium">{t("variantColumns.variant")}</th><th className="px-4 py-2 font-medium">{t("variantColumns.sku")}</th><th className="px-4 py-2 font-medium">{t("variantColumns.photos")}</th><th className="px-4 py-2 text-right font-medium">{t("variantColumns.price")}</th></tr></thead>
                    <tbody className="divide-y">
                      {variants.map((v) => (
                        <tr key={v.id}><td className="px-4 py-2">{v.name}</td><td className="px-4 py-2 font-mono text-xs text-muted-foreground">{v.sku ?? "—"}</td><td className="px-3 py-1"><VariantImages site={site.slug} variantId={v.id} variantName={v.name} gallery={gallery} initial={gallery.filter((g) => variantLinks.some((l) => l.variantId === v.id && l.productImageId === g.id)).map((g) => g.id)} /></td><td className="px-4 py-2 text-right tabular-nums">{money(v.price ?? p!.basePrice)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Surface>
            )}

            <Card title={t("cards.shipping")} description={t("shippingHint")}>
              <div className="grid grid-cols-2 gap-4 @min-[48rem]:grid-cols-4">
                {(["weight", "width", "height", "depth"] as const).map((k) => (
                  <Field key={k} label={t(`fields.${k}`)} htmlFor={k}>
                    <TextInput id={k} name={k} inputMode="decimal" defaultValue={p?.[k] ?? ""} />
                  </Field>
                ))}
              </div>
            </Card>

            <Card title={t("cards.seo")}>
              <Field label={t("fields.handle")} htmlFor="slug" hint={t("fields.handleHint", { path: `/products/${p?.slug ?? "…"}` })}>
                <TextInput id="slug" name="slug" defaultValue={p?.slug ?? ""} className="font-mono" />
              </Field>
              <Field label={t("fields.pageTitle")} htmlFor="metaTitle">
                <TextInput id="metaTitle" name="metaTitle" defaultValue={p?.metaTitle ?? ""} maxLength={120} placeholder={p?.name} />
              </Field>
              <Field label={t("fields.metaDescription")} htmlFor="metaDescription">
                <TextArea id="metaDescription" name="metaDescription" defaultValue={p?.metaDescription ?? ""} maxLength={320} rows={3} />
              </Field>
            </Card>
          </div>

          <div className="space-y-4 @min-[64rem]:sticky @min-[64rem]:top-4">
            <Card title={t("cards.status")}>
              <Select name="status" defaultValue={p?.isArchived ? "archived" : "active"} aria-label={t("fields.status")}>
                <option value="active">{ts("active")}</option>
                <option value="archived">{ts("archived")}</option>
              </Select>
            </Card>
            <Surface flush>
              <SwitchRow name="isFeatured" defaultChecked={p?.isFeatured ?? false} label={t("featured")} description={t("featuredHint")} />
            </Surface>
            <Card title={t("cards.organisation")}>
              <Field label={t("fields.brand")} htmlFor="brand">
                <TextInput id="brand" name="brand" defaultValue={p?.brand ?? ""} />
              </Field>
              <div className="space-y-2">
                <p className="flex items-baseline justify-between text-[13px] font-medium">
                  {t("fields.categories")}
                  <Link href={`/${site.slug}/products/categories`} className="text-xs font-normal text-muted-foreground hover:text-foreground">{t("fields.manage")}</Link>
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
                  <p className="text-xs text-muted-foreground">{t("noCategories")}</p>
                )}
              </div>
            </Card>
            {p && (
              <p className="px-1 text-xs text-muted-foreground">
                {p.legacyId
                  ? t("updatedLegacy", { time: format.relativeTime(new Date(p.updatedAt)), id: p.legacyId })
                  : t("updated", { time: format.relativeTime(new Date(p.updatedAt)) })}
              </p>
            )}
          </div>
        </div>
      </SettingsForm>
    </Page>
  );
}
