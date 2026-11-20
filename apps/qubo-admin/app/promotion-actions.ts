"use server";

import { db } from "@qubo/db/client";
import { discount, discountCondition, product, productCategory, siteSettings } from "@qubo/db/schema";
import { and, eq, inArray, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { notifyRevalidate } from "@qubo/studio";
import { requireSiteFromForm } from "@/lib/admin";
import type { ActionState } from "@/lib/action-state";
import { getCategoryTree, subtreeIds } from "@/lib/categories";
import { emitEntity } from "@/lib/events";
import { DEFAULT_ZONE, fromLocalInput } from "@/lib/zoned";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
type T = Awaited<ReturnType<typeof getTranslations<"promotions.errors">>>;
const errors = () => getTranslations("promotions.errors");

const amountSchema = (t: T) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(",", "."))
    .pipe(z.string().regex(/^\d+(\.\d{1,2})?$/, t("amount")));

const revalidate = (slug: string) => {
  revalidatePath(`/${slug}/promotions`);
  revalidatePath(`/${slug}/promotions/codes`);
  revalidatePath(`/${slug}/products`);
};

/** Prices are on cached storefront pages, so a sale change drops the site's cache too. */
const pricesChanged = async (slug: string) => {
  revalidate(slug);
  await notifyRevalidate(slug, []);
};

// ---------------------------------------------------------------- sale prices

/**
 * A sale moves the regular price to `compare_at_price` and sells at the new one,
 * which is what the storefront strikes through. Ending it moves it back.
 */
export async function setSalePrice(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { site, siteId } = await requireSiteFromForm(form);
  const t = await errors();
  const id = z.guid().safeParse(str(form, "productId"));
  if (!id.success) return { error: t("pickProduct") };
  const [row] = await db
    .select({ basePrice: product.basePrice, compareAtPrice: product.compareAtPrice })
    .from(product)
    .where(and(eq(product.id, id.data), eq(product.siteId, siteId)))
    .limit(1);
  if (!row) return { error: t("productGone") };
  const onSale = row.compareAtPrice !== null && Number(row.compareAtPrice) > Number(row.basePrice);
  const regular = onSale ? row.compareAtPrice! : row.basePrice;

  const raw = str(form, "salePrice");
  if (!raw) {
    if (!onSale) return { ok: true, at: Date.now() };
    await db.update(product).set({ basePrice: regular, compareAtPrice: null, updatedAt: new Date() }).where(eq(product.id, id.data));
  } else {
    const sale = amountSchema(t).safeParse(raw);
    if (!sale.success) return { error: sale.error.issues[0]?.message };
    if (Number(sale.data) <= 0 || Number(sale.data) >= Number(regular)) return { error: t("salePriceTooHigh", { regular }) };
    await db
      .update(product)
      .set({ basePrice: Number(sale.data).toFixed(2), compareAtPrice: regular, updatedAt: new Date() })
      .where(eq(product.id, id.data));
  }
  await emitEntity(siteId, "product", id.data);
  await pricesChanged(site.slug);
  return { ok: true, at: Date.now() };
}

/** Products a bulk action targets: a category subtree and/or a reference or name prefix. */
async function scope(siteId: string, form: FormData, t: T): Promise<SQL | { error: string }> {
  const categoryId = str(form, "categoryId");
  const prefix = str(form, "prefix");
  if (!categoryId && !prefix) return { error: t("pickScope") };
  const parts: SQL[] = [eq(product.siteId, siteId), eq(product.isArchived, false)];
  if (categoryId) {
    if (!z.guid().safeParse(categoryId).success) return { error: t("unknownCategory") };
    const tree = await getCategoryTree(siteId);
    if (!tree.some((c) => c.id === categoryId)) return { error: t("unknownCategory") };
    const ids = [...subtreeIds(tree, categoryId)];
    parts.push(inArray(product.id, db.select({ id: productCategory.productId }).from(productCategory).where(inArray(productCategory.categoryId, ids))));
  }
  if (prefix) {
    const like = `${prefix.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    parts.push(
      or(
        sql`${product.sourceSnapshot}->>'Référence' ilike ${like}`,
        sql`${product.legacyId} ilike ${like}`,
        sql`${product.name} ilike ${like}`,
      )!,
    );
  }
  return and(...parts)!;
}

export async function bulkSale(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { site, siteId } = await requireSiteFromForm(form);
  const t = await errors();
  const where = await scope(siteId, form, t);
  if ("error" in where) return where;
  const mode = str(form, "mode");

  if (mode === "end") {
    const rows = await db
      .update(product)
      .set({ basePrice: sql`${product.compareAtPrice}`, compareAtPrice: null, updatedAt: new Date() })
      .where(and(where, isNotNull(product.compareAtPrice), sql`${product.compareAtPrice} > ${product.basePrice}`))
      .returning({ id: product.id });
    if (rows.length) await pricesChanged(site.slug);
    return rows.length ? { ok: true, at: Date.now() } : { error: t("nothingOnSale") };
  }

  const pct = Number(str(form, "percent").replace(",", "."));
  if (!Number.isFinite(pct) || pct < 1 || pct > 90) return { error: t("percentRange") };
  // Products already on sale keep their regular price as the reference, so a second run re-prices, not compounds.
  const regular = sql`case when ${product.compareAtPrice} > ${product.basePrice} then ${product.compareAtPrice} else ${product.basePrice} end`;
  const rows = await db
    .update(product)
    .set({
      basePrice: sql`round(${regular} * ${(100 - pct) / 100}::numeric, 2)`,
      compareAtPrice: regular,
      updatedAt: new Date(),
    })
    .where(and(where, sql`${product.basePrice} > 0`))
    .returning({ id: product.id });
  if (rows.length) await pricesChanged(site.slug);
  return rows.length ? { ok: true, at: Date.now() } : { error: t("noProductMatches") };
}

// ---------------------------------------------------------------------- codes

const codeSchema = (t: T) => z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9_-]{1,39}$/, t("codeFormat")),
    name: z.string().trim().max(120),
    type: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "FREE_SHIPPING"]),
    value: z.string(),
    minPurchase: z.string(),
    maxUsesTotal: z.string(),
    maxUsesPerCustomer: z.string(),
    minQuantity: z.string(),
    startsAt: z.string(),
    endsAt: z.string(),
    isActive: z.boolean(),
  })
  .superRefine((d, ctx) => {
    if (d.type !== "FREE_SHIPPING") {
      const v = Number(d.value.replace(",", "."));
      if (!Number.isFinite(v) || v <= 0) ctx.addIssue({ code: "custom", message: t("valueRequired") });
      if (d.type === "PERCENTAGE" && v > 100) ctx.addIssue({ code: "custom", message: t("percentMax") });
    }
    for (const [k, message] of [
      ["minPurchase", t("checkMinPurchase")],
      ["maxUsesTotal", t("checkMaxUsesTotal")],
      ["maxUsesPerCustomer", t("checkMaxUsesPerCustomer")],
      ["minQuantity", t("checkMinQuantity")],
    ] as const) {
      const v = d[k].replace(",", ".");
      if (v && !(Number(v) >= 0)) ctx.addIssue({ code: "custom", message });
    }
    if (d.startsAt && d.endsAt && d.endsAt <= d.startsAt) ctx.addIssue({ code: "custom", message: t("endBeforeStart") });
  });

const num = (v: string) => (v ? v.replace(",", ".") : null);
const int = (v: string) => (v ? Math.max(0, Math.floor(Number(v))) || null : null);

async function productIdsFor(siteId: string, refs: string): Promise<{ ids: string[]; missing: string[] }> {
  const wanted = [...new Set(refs.split(/[\s,;]+/).map((r) => r.trim()).filter(Boolean))].slice(0, 500);
  if (!wanted.length) return { ids: [], missing: [] };
  const upper = wanted.map((w) => w.toUpperCase());
  const rows = await db
    .select({ id: product.id, slug: product.slug, ref: sql<string | null>`upper(${product.sourceSnapshot}->>'Référence')`, legacy: sql<string | null>`upper(${product.legacyId})` })
    .from(product)
    .where(
      and(
        eq(product.siteId, siteId),
        or(inArray(product.slug, wanted), sql`upper(${product.sourceSnapshot}->>'Référence') in ${upper}`, sql`upper(${product.legacyId}) in ${upper}`),
      ),
    );
  const found = new Set(rows.flatMap((r) => [r.slug.toUpperCase(), r.ref, r.legacy]).filter(Boolean));
  return { ids: [...new Set(rows.map((r) => r.id))], missing: wanted.filter((w) => !found.has(w.toUpperCase())) };
}

export async function saveDiscount(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { site, siteId, user } = await requireSiteFromForm(form);
  const t = await errors();
  const idRaw = str(form, "id");
  const id = idRaw ? z.guid().safeParse(idRaw) : null;
  if (id && !id.success) return { error: t("unknownCode") };
  const parsed = codeSchema(t).safeParse({
    code: str(form, "code"),
    name: str(form, "name"),
    type: str(form, "type"),
    value: str(form, "value"),
    minPurchase: str(form, "minPurchase"),
    maxUsesTotal: str(form, "maxUsesTotal"),
    maxUsesPerCustomer: str(form, "maxUsesPerCustomer"),
    minQuantity: str(form, "minQuantity"),
    startsAt: str(form, "startsAt"),
    endsAt: str(form, "endsAt"),
    isActive: form.get("isActive") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("checkFields") };
  const d = parsed.data;

  const products = await productIdsFor(siteId, str(form, "products"));
  if (products.missing.length) return { error: t("noProductFor", { references: products.missing.slice(0, 5).join(", ") }) };
  const tree = await getCategoryTree(siteId);
  const known = new Set(tree.map((c) => c.id));
  const categoryIds = form.getAll("categoryIds").map(String).filter((c) => known.has(c));

  const [clash] = await db
    .select({ id: discount.id })
    .from(discount)
    .where(and(eq(discount.siteId, siteId), sql`upper(${discount.code}) = ${d.code}`, id?.data ? sql`${discount.id} <> ${id.data}` : undefined))
    .limit(1);
  if (clash) return { error: t("codeExists", { code: d.code }) };

  const [settings] = await db.select({ timezone: siteSettings.timezone }).from(siteSettings).where(eq(siteSettings.siteId, siteId)).limit(1);
  const zone = settings?.timezone ?? DEFAULT_ZONE;
  const values = {
    code: d.code,
    name: d.name || null,
    type: d.type,
    value: d.type === "FREE_SHIPPING" ? "0" : Number(d.value.replace(",", ".")).toFixed(2),
    minPurchaseAmount: num(d.minPurchase),
    maxUsesTotal: int(d.maxUsesTotal),
    maxUsesPerCustomer: int(d.maxUsesPerCustomer),
    startsAt: fromLocalInput(d.startsAt, zone),
    endsAt: fromLocalInput(d.endsAt, zone),
    isActive: d.isActive,
    updatedAt: new Date(),
    updatedById: user.id,
  };
  const minQty = int(d.minQuantity);

  const saved = await db.transaction(async (tx) => {
    let discountId = id?.data;
    if (discountId) {
      const [row] = await tx.update(discount).set(values).where(and(eq(discount.id, discountId), eq(discount.siteId, siteId))).returning({ id: discount.id });
      if (!row) return null;
      await tx.delete(discountCondition).where(eq(discountCondition.discountId, discountId));
    } else {
      const [row] = await tx.insert(discount).values({ ...values, siteId }).returning({ id: discount.id });
      discountId = row!.id;
    }
    const conditions = [
      products.ids.length ? { discountId, type: "SPECIFIC_PRODUCTS" as const, targetIds: products.ids } : null,
      categoryIds.length ? { discountId, type: "SPECIFIC_CATEGORIES" as const, targetIds: categoryIds } : null,
      minQty && minQty > 1 ? { discountId, type: "MIN_QUANTITY" as const, targetIds: [String(minQty)] } : null,
    ].filter((c) => c !== null);
    if (conditions.length) await tx.insert(discountCondition).values(conditions);
    return discountId;
  });
  if (!saved) return { error: t("codeDeleted") };
  await emitEntity(siteId, "discount", saved, id?.data ? "updated" : "created");
  revalidate(site.slug);
  if (!id?.data) redirect(`/${site.slug}/promotions/codes?id=${saved}`);
  return { ok: true, at: Date.now() };
}

export async function toggleDiscount(form: FormData) {
  const { site, siteId, user } = await requireSiteFromForm(form);
  const id = z.guid().parse(str(form, "id"));
  await db
    .update(discount)
    .set({ isActive: sql`not ${discount.isActive}`, updatedAt: new Date(), updatedById: user.id })
    .where(and(eq(discount.id, id), eq(discount.siteId, siteId)));
  await emitEntity(siteId, "discount", id);
  revalidate(site.slug);
}

/** Used codes are kept (orders point at them); only unused ones can be deleted. */
export async function deleteDiscount(form: FormData) {
  const { site, siteId } = await requireSiteFromForm(form);
  const id = z.guid().parse(str(form, "id"));
  await db.delete(discount).where(and(eq(discount.id, id), eq(discount.siteId, siteId), eq(discount.usedCount, 0)));
  await emitEntity(siteId, "discount", id, "deleted");
  revalidate(site.slug);
  redirect(`/${site.slug}/promotions/codes`);
}
