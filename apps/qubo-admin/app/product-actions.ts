"use server";

import { db } from "@qubo/db/client";
import { category, product, productCategory } from "@qubo/db/schema";
import { and, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSiteFromForm } from "@/lib/admin";
import type { ActionState } from "@/lib/action-state";

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

export async function saveProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let createdId: string | null = null;
  let slugForRedirect = "";
  try {
    const { siteId, site } = await requireSiteFromForm(formData);
    const id = String(formData.get("id") ?? "");
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
    const isNew = id === "new" || !id;
    const savedId = await db.transaction(async (tx) => {
      const [row] = isNew
        ? await tx.insert(product).values({ ...values, siteId }).returning({ id: product.id })
        : await tx.update(product).set(values).where(and(eq(product.id, id), eq(product.siteId, siteId))).returning({ id: product.id });
      if (!row) return null;
      await tx.delete(productCategory).where(eq(productCategory.productId, row.id));
      if (categoryIds.length) await tx.insert(productCategory).values(categoryIds.map((categoryId) => ({ productId: row.id, categoryId })));
      return row.id;
    });
    if (!savedId) return { error: "Product not found on this site." };
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
