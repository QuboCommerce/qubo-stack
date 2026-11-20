"use server";

import { db } from "@qubo/db/client";
import { category } from "@qubo/db/schema";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { slugify } from "@/app/product-actions";
import { requireSiteFromForm } from "@/lib/admin";
import type { ActionState } from "@/lib/action-state";
import { getCategoryTree, subtreeIds } from "@/lib/categories";
import { emitEntity } from "@/lib/events";
import { categorySpec, categoryValues } from "@/lib/form-specs";
import { reconcile, unchangedSince } from "@/lib/merge-server";

const idSchema = z.uuid();
type Errors = Awaited<ReturnType<typeof getTranslations<"categories.errors">>>;

const buildSchema = (t: Errors) =>
  z.object({
    name: z.string().trim().min(1, t("nameRequired")).max(120),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, t("handleFormat")),
    description: z.string().max(5000),
    parentId: z.union([z.literal(""), z.uuid()]),
  });

const siblingsOf = (siteId: string, parentId: string | null) =>
  and(eq(category.siteId, siteId), parentId ? eq(category.parentId, parentId) : isNull(category.parentId));

async function nextPosition(siteId: string, parentId: string | null) {
  const [row] = await db
    .select({ value: sql<number>`coalesce(max(${category.position}) + 1, 0)::int` })
    .from(category)
    .where(siblingsOf(siteId, parentId));
  return row?.value ?? 0;
}

async function uniqueSlug(siteId: string, base: string, exceptId?: string) {
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`.slice(0, 80);
    const [clash] = await db
      .select({ id: category.id })
      .from(category)
      .where(and(eq(category.siteId, siteId), eq(category.slug, candidate), exceptId ? ne(category.id, exceptId) : undefined))
      .limit(1);
    if (!clash) return candidate;
  }
}

const revalidate = (slug: string) => {
  revalidatePath(`/${slug}/products/categories`);
  revalidatePath(`/${slug}/products`);
};

export async function saveCategory(_prev: ActionState, submitted: FormData): Promise<ActionState> {
  const t = await getTranslations("categories.errors");
  try {
    const { siteId, site } = await requireSiteFromForm(submitted);
    const id = idSchema.parse(submitted.get("id"));
    const [row] = await db.select().from(category).where(and(eq(category.id, id), eq(category.siteId, siteId))).limit(1);
    if (!row) return { error: t("deleted") };
    const names = await db.select({ id: category.id, name: category.name }).from(category).where(eq(category.siteId, siteId));
    const r = await reconcile(submitted, categorySpec(new Map(names.map((c) => [c.id, c.name]))), categoryValues(row), { siteId, table: "category", id });
    if ("conflict" in r) return { conflict: r.conflict };
    const formData = r.formData;
    const str = (k: string) => String(formData.get(k) ?? "");
    const parsed = buildSchema(t).safeParse({
      name: str("name"),
      slug: str("slug") || (await slugify(str("name"))),
      description: str("description"),
      parentId: str("parentId"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("checkFields") };
    const d = parsed.data;

    const tree = await getCategoryTree(siteId);
    const current = tree.find((n) => n.id === id);
    if (!current) return { error: t("notFound") };
    const parentId = d.parentId || null;
    if (parentId) {
      if (!tree.some((n) => n.id === parentId)) return { error: t("parentGone") };
      if (subtreeIds(tree, id).has(parentId)) return { error: t("moveInside") };
    }

    const [clash] = await db
      .select({ id: category.id })
      .from(category)
      .where(and(eq(category.siteId, siteId), eq(category.slug, d.slug), ne(category.id, id)))
      .limit(1);
    if (clash) return { error: t("handleTaken") };

    const moved = (current.parentId ?? null) !== parentId;
    const saved = await db
      .update(category)
      .set({
        name: d.name,
        slug: d.slug,
        description: d.description.trim() || null,
        parentId,
        ...(moved ? { position: await nextPosition(siteId, parentId) } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(category.id, id), eq(category.siteId, siteId), unchangedSince(category.updatedAt, row.updatedAt)))
      .returning({ id: category.id });
    if (!saved.length) return { error: t("race") };
    await emitEntity(siteId, "category", id);
    revalidate(site.slug);
  } catch (e) {
    return { error: e instanceof Error ? e.message : t("generic") };
  }
  return { ok: true, at: Date.now() };
}

export async function createCategory(formData: FormData) {
  const t = await getTranslations("categories");
  const { siteId, site } = await requireSiteFromForm(formData);
  const rawParent = String(formData.get("parentId") ?? "");
  const parentId = rawParent ? idSchema.parse(rawParent) : null;
  if (parentId) {
    const [parent] = await db
      .select({ id: category.id })
      .from(category)
      .where(and(eq(category.id, parentId), eq(category.siteId, siteId)))
      .limit(1);
    if (!parent) throw new Error(t("errors.parentNotFound"));
  }
  const name = parentId ? t("defaults.newSubcategory") : t("defaults.newCategory");
  const [row] = await db
    .insert(category)
    .values({
      siteId,
      parentId,
      name,
      slug: await uniqueSlug(siteId, await slugify(name)),
      position: await nextPosition(siteId, parentId),
    })
    .returning({ id: category.id });
  await emitEntity(siteId, "category", "tree");
  revalidate(site.slug);
  redirect(`/${site.slug}/products/categories?id=${row!.id}`);
}

/** Swaps the category with its previous or next sibling. */
export async function moveCategory(formData: FormData) {
  const t = await getTranslations("categories.errors");
  const { siteId, site } = await requireSiteFromForm(formData);
  const id = idSchema.parse(formData.get("id"));
  const direction = formData.get("direction") === "up" ? -1 : 1;
  const [current] = await db
    .select({ parentId: category.parentId })
    .from(category)
    .where(and(eq(category.id, id), eq(category.siteId, siteId)))
    .limit(1);
  if (!current) throw new Error(t("notFound"));

  await db.transaction(async (tx) => {
    const siblings = await tx
      .select({ id: category.id })
      .from(category)
      .where(siblingsOf(siteId, current.parentId))
      .orderBy(category.position, category.name);
    const from = siblings.findIndex((s) => s.id === id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= siblings.length) return;
    [siblings[from], siblings[to]] = [siblings[to]!, siblings[from]!];
    // Renumber the whole sibling list so legacy duplicates in `position` can't stall the move.
    for (const [position, s] of siblings.entries()) {
      await tx.update(category).set({ position }).where(eq(category.id, s.id));
    }
  });
  await emitEntity(siteId, "category", "tree");
  revalidate(site.slug);
}

/** Deletes the category. Its subcategories move up one level; product links to it are removed. */
export async function deleteCategory(formData: FormData) {
  const t = await getTranslations("categories.errors");
  const { siteId, site } = await requireSiteFromForm(formData);
  const id = idSchema.parse(formData.get("id"));
  const [current] = await db
    .select({ parentId: category.parentId })
    .from(category)
    .where(and(eq(category.id, id), eq(category.siteId, siteId)))
    .limit(1);
  if (!current) throw new Error(t("notFound"));

  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ value: sql<number>`coalesce(max(${category.position}) + 1, 0)::int` })
      .from(category)
      .where(siblingsOf(siteId, current.parentId));
    const children = await tx
      .select({ id: category.id })
      .from(category)
      .where(and(eq(category.siteId, siteId), eq(category.parentId, id)))
      .orderBy(category.position, category.name);
    for (const [i, child] of children.entries()) {
      await tx
        .update(category)
        .set({ parentId: current.parentId, position: (row?.value ?? 0) + i })
        .where(eq(category.id, child.id));
    }
    await tx.delete(category).where(and(eq(category.id, id), eq(category.siteId, siteId)));
  });
  await emitEntity(siteId, "category", "tree");
  revalidate(site.slug);
  redirect(`/${site.slug}/products/categories${current.parentId ? `?id=${current.parentId}` : ""}`);
}
