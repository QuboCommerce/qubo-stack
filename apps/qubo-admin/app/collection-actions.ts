"use server";

import { db } from "@qubo/db/client";
import { collection, collectionProduct, product } from "@qubo/db/schema";
import { COLLECTION_SORTS, parseRules } from "@qubo/db/collection-rules";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { notifyRevalidate } from "@qubo/studio";
import { slugify } from "@/app/product-actions";
import { requireSite, requireSiteFromForm } from "@/lib/admin";
import type { ActionState } from "@/lib/action-state";
import { getCategoryTree } from "@/lib/categories";
import { describeRules } from "@/lib/collection-summary";
import { collectionValues, MAX_PICKS, pickedIds, previewDraft, productCards, type CollectionDraft } from "@/lib/collections";
import { emitEntity } from "@/lib/events";
import type { MergeSpec } from "@/lib/merge";
import { reconcile, unchangedSince } from "@/lib/merge-server";

type T = Awaited<ReturnType<typeof getTranslations<"collections">>>;

const json = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const draftSchema = z.object({
  kind: z.enum(["smart", "manual"]),
  match: z.enum(["all", "any"]),
  rules: z.unknown().transform(parseRules),
  productIds: z.array(z.guid()).max(MAX_PICKS).transform((ids) => [...new Set(ids)]),
  sort: z.enum(COLLECTION_SORTS),
});

const toDraft = (d: z.infer<typeof draftSchema>): CollectionDraft => ({
  ...d,
  // Manual order only exists for hand-picked products.
  sort: d.kind === "smart" && d.sort === "manual" ? "featured" : d.sort,
});

const fieldsSchema = (t: T) =>
  z.object({
    name: z.string().trim().min(1, t("errors.nameRequired")).max(120),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, t("errors.handleFormat")),
    description: z.string().trim().max(5000),
    image: z
      .string()
      .trim()
      .max(2000)
      .refine((v) => !v || v.startsWith("/api/media/") || v.startsWith("/api/legacy-assets/") || /^https?:\/\/\S+$/.test(v), t("errors.imageUrl")),
    metaTitle: z.string().trim().max(120),
    metaDescription: z.string().trim().max(320),
    isPublished: z.boolean(),
  });

async function mergeSpec(siteId: string, currency: string, t: T): Promise<MergeSpec> {
  const [tree, locale, format] = await Promise.all([getCategoryTree(siteId), getLocale(), getFormatter()]);
  const names = new Map(tree.map((c) => [c.id, c.name]));
  return {
    name: { label: t("editor.fields.name") },
    slug: { label: t("editor.fields.handle") },
    description: { label: t("editor.fields.description") },
    image: { label: t("merge.image") },
    metaTitle: { label: t("editor.fields.metaTitle") },
    metaDescription: { label: t("editor.fields.metaDescription") },
    kind: { label: t("merge.kind"), format: (v) => (v === "manual" ? t("editor.kind.manual") : t("editor.kind.smart")) },
    match: { label: t("merge.match"), format: (v) => (v === "any" ? t("editor.match.any") : t("editor.match.all")) },
    rules: {
      label: t("merge.rules"),
      format: (v) =>
        describeRules(json(String(v)), "all", {
          locale,
          phrase: (key, values) => t(`rules.phrases.${key}`, values),
          categoryName: (id) => names.get(id) ?? t("rules.deletedCategory"),
          money: (n) => format.number(n, { style: "currency", currency }),
        }) ?? t("summary.noRules"),
    },
    productIds: {
      label: t("merge.products"),
      format: (v) => t("summary.manual", { count: (json(String(v)) as unknown[] | null)?.length ?? 0 }),
    },
    sort: { label: t("editor.fields.sort"), format: (v) => t(`sort.${sortKey(String(v))}`) },
    isPublished: { label: t("merge.publish"), format: (v) => (v === "on" ? t("status.published") : t("status.draft")) },
  };
}

const sortKey = (s: string) =>
  (({ price_asc: "priceAsc", price_desc: "priceDesc", newest: "newest", name: "name", manual: "manual" }) as Record<string, "priceAsc" | "priceDesc" | "newest" | "name" | "manual">)[s] ??
  "featured";

const revalidateAdmin = (siteSlug: string, id?: string) => {
  revalidatePath(`/${siteSlug}/products/collections`);
  if (id) revalidatePath(`/${siteSlug}/products/collections/${id}`);
};

/** Storefront pages are cached per site, so one call covers both the old and the new `/collections/<slug>`. */
const revalidateStorefront = (siteSlug: string) => notifyRevalidate(siteSlug, []);

export async function saveCollection(_prev: ActionState, submitted: FormData): Promise<ActionState> {
  const t = await getTranslations("collections");
  const { site, siteId, user } = await requireSiteFromForm(submitted);
  const rawId = String(submitted.get("id") ?? "");
  const isNew = rawId === "new";
  const parsedId = isNew ? null : z.guid().safeParse(rawId);
  if (parsedId && !parsedId.success) return { error: t("errors.notFound") };
  const id = parsedId?.data ?? null;

  const [row] = id ? await db.select().from(collection).where(and(eq(collection.id, id), eq(collection.siteId, siteId))).limit(1) : [null];
  if (id && !row) return { error: t("errors.notFound") };

  let formData = submitted;
  if (row) {
    const r = await reconcile(submitted, await mergeSpec(siteId, site.currency ?? "EUR", t), collectionValues(row, await pickedIds(row.id)), {
      siteId,
      table: "collection",
      id: row.id,
    });
    if ("conflict" in r) return { conflict: r.conflict };
    formData = r.formData;
  }
  const str = (k: string) => String(formData.get(k) ?? "");

  const fields = fieldsSchema(t).safeParse({
    name: str("name"),
    slug: str("slug") || (await slugify(str("name"))),
    description: str("description"),
    image: str("image"),
    metaTitle: str("metaTitle"),
    metaDescription: str("metaDescription"),
    isPublished: formData.get("isPublished") === "on",
  });
  if (!fields.success) return { error: fields.error.issues[0]?.message ?? t("errors.checkFields") };
  const draft = draftSchema.safeParse({
    kind: str("kind"),
    match: str("match") || "all",
    rules: json(str("rules")),
    productIds: json(str("productIds")) ?? [],
    sort: str("sort") || "featured",
  });
  if (!draft.success) {
    const tooMany = draft.error.issues.some((i) => i.path[0] === "productIds" && i.code === "too_big");
    return { error: tooMany ? t("errors.tooManyProducts", { max: MAX_PICKS }) : t("errors.checkFields") };
  }
  const f = fields.data;
  const d = toDraft(draft.data);

  const [clash] = await db
    .select({ id: collection.id })
    .from(collection)
    .where(and(eq(collection.siteId, siteId), eq(collection.slug, f.slug), id ? ne(collection.id, id) : undefined))
    .limit(1);
  if (clash) return { error: t("errors.handleTaken") };

  // Picks are kept even while the collection is automatic, so switching back loses nothing.
  const owned = d.productIds.length
    ? new Set(
        (await db.select({ id: product.id }).from(product).where(and(eq(product.siteId, siteId), inArray(product.id, d.productIds)))).map((p) => p.id),
      )
    : new Set<string>();
  const picks = d.productIds.filter((p) => owned.has(p));

  const values = {
    name: f.name,
    slug: f.slug,
    description: f.description || null,
    image: f.image || null,
    metaTitle: f.metaTitle || null,
    metaDescription: f.metaDescription || null,
    kind: d.kind,
    match: d.match,
    rules: d.rules,
    sort: d.sort,
    isPublished: f.isPublished,
    updatedAt: new Date(),
    updatedById: user.id,
  };

  const savedId = await db.transaction(async (tx) => {
    let target: string;
    if (row) {
      const [updated] = await tx
        .update(collection)
        .set(values)
        .where(and(eq(collection.id, row.id), eq(collection.siteId, siteId), unchangedSince(collection.updatedAt, row.updatedAt)))
        .returning({ id: collection.id });
      if (!updated) return null;
      target = updated.id;
      await tx.delete(collectionProduct).where(eq(collectionProduct.collectionId, target));
    } else {
      const [{ next } = { next: 0 }] = await tx
        .select({ next: sql<number>`coalesce(max(${collection.position}) + 1, 0)::int` })
        .from(collection)
        .where(eq(collection.siteId, siteId));
      const [created] = await tx.insert(collection).values({ ...values, siteId, position: next }).returning({ id: collection.id });
      target = created!.id;
    }
    if (picks.length) await tx.insert(collectionProduct).values(picks.map((productId, position) => ({ collectionId: target, productId, position })));
    return target;
  });
  if (!savedId) return { error: t("errors.race") };

  await emitEntity(siteId, "collection", savedId, row ? "updated" : "created");
  revalidateAdmin(site.slug, savedId);
  if (row?.isPublished || f.isPublished) await revalidateStorefront(site.slug);
  if (!row) redirect(`/${site.slug}/products/collections/${savedId}`);
  return { ok: true, at: Date.now() };
}

export async function deleteCollection(form: FormData) {
  const { site, siteId } = await requireSiteFromForm(form);
  const id = z.guid().parse(String(form.get("id") ?? ""));
  const [gone] = await db
    .delete(collection)
    .where(and(eq(collection.id, id), eq(collection.siteId, siteId)))
    .returning({ isPublished: collection.isPublished });
  if (gone) {
    await emitEntity(siteId, "collection", id, "deleted");
    if (gone.isPublished) await revalidateStorefront(site.slug);
  }
  revalidateAdmin(site.slug);
  redirect(`/${site.slug}/products/collections`);
}

/** Products to hand-pick: name or reference, newest match first. */
export async function searchCollectionProducts(siteSlug: string, query: string) {
  const { siteId } = await requireSite(siteSlug);
  const q = String(query ?? "").trim().slice(0, 100);
  if (!q) return [];
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return productCards(
    and(
      eq(product.siteId, siteId),
      eq(product.isArchived, false),
      sql`(${product.name} ilike ${like}
        or ${product.legacyId} ilike ${like}
        or ${product.sourceSnapshot}->>'Référence' ilike ${like}
        or exists (select 1 from product_variant v where v.product_id = "product"."id" and v.sku ilike ${like}))`,
    )!,
    [sql`(${product.sourceSnapshot}->>'Référence' ilike ${like.slice(1)}) desc`, sql`${product.name} asc`],
    20,
  );
}

/** Count and first products of an unsaved collection, as the storefront would list them. */
export async function previewCollection(siteSlug: string, input: unknown) {
  const { siteId } = await requireSite(siteSlug);
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { count: 0, items: [] };
  return previewDraft(siteId, toDraft(parsed.data));
}
