"use server";

import { db } from "@qubo/db/client";
import { category, product, productCategory, productImage, productVariant, productVariantImage } from "@qubo/db/schema";
import { galleryAssetIds } from "@qubo/storage/media";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSite, requireSiteFromForm } from "@/lib/admin";
import type { ActionState } from "@/lib/action-state";
import { emitEntity } from "@/lib/events";
import { assetUrl } from "@/lib/format";
import { productSpec, productValues } from "@/lib/form-specs";
import { RACE, reconcile, unchangedSince } from "@/lib/merge-server";

const uuid = /^[0-9a-f-]{36}$/i;

const money = z
  .string()
  .trim()
  .transform((v) => v.replace(",", "."))
  .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), "Prices use numbers like 1299.00.");
const optNum = z
  .string()
  .trim()
  .transform((v) => v.replace(",", "."))
  .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), "Use a positive number.");

const schema = z.object({
  name: z.string().trim().min(2, "The title needs at least 2 characters.").max(255),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "The handle uses lowercase letters, numbers and dashes."),
  description: z.string().max(20000),
  brand: z.string().trim().max(120),
  basePrice: money.refine((v) => v !== "", "Enter a price."),
  compareAtPrice: money,
  weight: optNum,
  width: optNum,
  height: optNum,
  depth: optNum,
  metaTitle: z.string().trim().max(120),
  metaDescription: z.string().trim().max(320),
  isArchived: z.boolean(),
  isFeatured: z.boolean(),
});

export const slugify = async (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

export async function saveProduct(_prev: ActionState, submitted: FormData): Promise<ActionState> {
  let createdId: string | null = null;
  let slugForRedirect = "";
  try {
    const { siteId, site } = await requireSiteFromForm(submitted);
    const id = String(submitted.get("id") ?? "");
    const isNew = id === "new" || !id;
    let formData = submitted;
    let seenAt: Date | null = null;
    if (!isNew) {
      if (!uuid.test(id)) return { error: "Product not found on this site." };
      const [current] = await db.select().from(product).where(and(eq(product.id, id), eq(product.siteId, siteId))).limit(1);
      if (!current) return { error: "This product was deleted by someone else." };
      seenAt = current.updatedAt;
      const [links, cats] = await Promise.all([
        db.select({ id: productCategory.categoryId }).from(productCategory).where(eq(productCategory.productId, id)),
        db.select({ id: category.id, name: category.name }).from(category).where(eq(category.siteId, siteId)),
      ]);
      const r = await reconcile(
        submitted,
        productSpec(new Map(cats.map((c) => [c.id, c.name]))),
        productValues(current, links.map((l) => l.id)),
        { siteId, table: "product", id },
      );
      if ("conflict" in r) return { conflict: r.conflict };
      formData = r.formData;
    }
    const str = (k: string) => String(formData.get(k) ?? "");
    const rawSlug = str("slug") || (await slugify(str("name")));
    const parsed = schema.safeParse({
      name: str("name"),
      slug: rawSlug,
      description: str("description"),
      brand: str("brand"),
      basePrice: str("basePrice"),
      compareAtPrice: str("compareAtPrice"),
      weight: str("weight"),
      width: str("width"),
      height: str("height"),
      depth: str("depth"),
      metaTitle: str("metaTitle"),
      metaDescription: str("metaDescription"),
      isArchived: str("status") === "archived",
      isFeatured: formData.get("isFeatured") === "on",
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
    const d = parsed.data;
    const nul = (v: string) => (v === "" ? null : v);

    const clash = await db
      .select({ id: product.id })
      .from(product)
      .where(and(eq(product.siteId, siteId), eq(product.slug, d.slug), id && id !== "new" ? ne(product.id, id) : undefined))
      .limit(1);
    if (clash.length) return { error: "Another product already uses this handle." };

    const requested = [...new Set(formData.getAll("categoryIds").map(String).filter((v) => uuid.test(v)))];
    const categoryIds = requested.length
      ? (await db.select({ id: category.id }).from(category).where(and(eq(category.siteId, siteId), inArray(category.id, requested)))).map((r) => r.id)
      : [];
    if (categoryIds.length !== requested.length) return { error: "One of the categories no longer exists. Reload the page and try again." };

    const values = {
      name: d.name,
      slug: d.slug,
      description: nul(d.description.trim()),
      brand: nul(d.brand),
      basePrice: d.basePrice,
      compareAtPrice: nul(d.compareAtPrice),
      weight: nul(d.weight),
      width: nul(d.width),
      height: nul(d.height),
      depth: nul(d.depth),
      metaTitle: nul(d.metaTitle),
      metaDescription: nul(d.metaDescription),
      isArchived: d.isArchived,
      isFeatured: d.isFeatured,
      updatedAt: new Date(),
    };
    const savedId = await db.transaction(async (tx) => {
      const [row] = isNew
        ? await tx.insert(product).values({ ...values, siteId }).returning({ id: product.id })
        : await tx
            .update(product)
            .set(values)
            .where(and(eq(product.id, id), eq(product.siteId, siteId), seenAt ? unchangedSince(product.updatedAt, seenAt) : undefined))
            .returning({ id: product.id });
      if (!row) return null;
      await tx.delete(productCategory).where(eq(productCategory.productId, row.id));
      if (categoryIds.length) await tx.insert(productCategory).values(categoryIds.map((categoryId) => ({ productId: row.id, categoryId })));
      return row.id;
    });
    if (!savedId) return { error: RACE };
    await emitEntity(siteId, "product", savedId, isNew ? "created" : "updated");
    if (isNew) {
      createdId = savedId;
      slugForRedirect = site.slug;
    } else {
      revalidatePath(`/${site.slug}/products/${id}`);
    }
    revalidatePath(`/${site.slug}/products`);
    revalidatePath(`/${site.slug}/products/categories`);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
  if (createdId) redirect(`/${slugForRedirect}/products/${createdId}`);
  return { ok: true, at: Date.now() };
}

export type GalleryImage = { url: string; alt: string; src: string };

/** A product's whole gallery, for the Media page's product sheet. */
export async function productGalleryAction(input: { site: string; productId: string }): Promise<{ name: string; images: GalleryImage[] } | null> {
  const { siteId } = await requireSite(input.site);
  const parsed = z.uuid().safeParse(input.productId);
  if (!parsed.success) return null;
  const productId = parsed.data;
  const [row] = await db.select({ name: product.name }).from(product).where(and(eq(product.id, productId), eq(product.siteId, siteId)));
  if (!row) return null;
  const images = await db.select().from(productImage).where(eq(productImage.productId, productId)).orderBy(asc(productImage.position));
  return { name: row.name, images: images.map((i) => ({ url: i.url, alt: i.alt ?? "", src: assetUrl(i.url) ?? i.url })) };
}

const imagesSchema = z.object({
  productId: z.uuid(),
  images: z.array(z.object({ url: z.string().min(1).max(2000), alt: z.string().max(300) })).max(50),
});

/** Replaces the product's gallery (order = position; the first is the main image). */
export async function setProductImagesAction(input: { site: string; productId: string; images: { url: string; alt: string }[] }): Promise<ActionState> {
  const { site, siteId } = await requireSite(input.site);
  const parsed = imagesSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid images." };
  const { productId, images } = parsed.data;
  const assetIds = await galleryAssetIds(site.organizationId, images.map((i) => i.url));
  const ok = await db.transaction(async (tx) => {
    const [row] = await tx.select({ id: product.id }).from(product).where(and(eq(product.id, productId), eq(product.siteId, siteId)));
    if (!row) return false;
    // Keep the row of an image that stays (by URL) so variant links to it survive a reorder.
    const existing = await tx.select({ id: productImage.id, url: productImage.url }).from(productImage).where(eq(productImage.productId, productId));
    const free = Map.groupBy(existing, (r) => r.url);
    const kept: string[] = [];
    for (const [position, img] of images.entries()) {
      const values = { url: img.url, assetId: assetIds[position], alt: img.alt || null, position };
      const row = free.get(img.url)?.shift();
      if (row) {
        kept.push(row.id);
        await tx.update(productImage).set(values).where(eq(productImage.id, row.id));
      } else await tx.insert(productImage).values({ productId, ...values });
    }
    const gone = existing.filter((r) => !kept.includes(r.id)).map((r) => r.id);
    if (gone.length) await tx.delete(productImage).where(inArray(productImage.id, gone));
    return true;
  });
  if (!ok) return { error: "Product not found." };
  await emitEntity(siteId, "product", productId, "updated");
  revalidatePath(`/${site.slug}/products/${productId}`);
  revalidatePath(`/${site.slug}/products`);
  return { ok: true, at: Date.now() };
}

/** Sets which gallery photos belong to a variant. Ids outside the product's gallery are ignored. */
export async function setVariantImagesAction(input: { site: string; variantId: string; imageIds: string[] }): Promise<ActionState> {
  const { site, siteId } = await requireSite(input.site);
  const p = z.object({ variantId: z.uuid(), imageIds: z.array(z.uuid()).max(50) }).safeParse(input);
  if (!p.success) return { error: "Invalid images." };
  const [variant] = await db
    .select({ productId: productVariant.productId })
    .from(productVariant)
    .where(and(eq(productVariant.id, p.data.variantId), eq(productVariant.siteId, siteId)));
  if (!variant) return { error: "Variant not found." };
  const valid = p.data.imageIds.length
    ? (await db.select({ id: productImage.id }).from(productImage).where(and(eq(productImage.productId, variant.productId), inArray(productImage.id, p.data.imageIds)))).map((r) => r.id)
    : [];
  await db.transaction(async (tx) => {
    await tx.delete(productVariantImage).where(eq(productVariantImage.variantId, p.data.variantId));
    if (valid.length) await tx.insert(productVariantImage).values(valid.map((productImageId) => ({ variantId: p.data.variantId, productImageId })));
  });
  await emitEntity(siteId, "product", variant.productId, "updated");
  revalidatePath(`/${site.slug}/products/${variant.productId}`);
  return { ok: true, at: Date.now() };
}
