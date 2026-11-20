"use server";

import { db } from "@qubo/db/client";
import { inventoryHistory, inventoryItem, product, productVariant } from "@qubo/db/schema";
import { notifyRevalidate } from "@qubo/studio";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireSite } from "@/lib/admin";
import { emitEntity } from "@/lib/events";
import { getInventoryDetail, type InventoryDetail } from "@/lib/inventory";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type StockResult = { ok: true; quantity: number } | { ok: false; error: string; quantity?: number };

const MAX = 1_000_000;
const qty = z.number().int().min(0).max(MAX);
const errors = () => getTranslations("inventory.errors");

/** The variant must belong to the site; returns what revalidation needs. */
async function variantOf(siteId: string, variantId: string) {
  if (!z.guid().safeParse(variantId).success) return null;
  const [row] = await db
    .select({ productId: product.id })
    .from(productVariant)
    .innerJoin(product, eq(product.id, productVariant.productId))
    .where(and(eq(productVariant.id, variantId), eq(productVariant.siteId, siteId), eq(product.siteId, siteId)))
    .limit(1);
  return row ?? null;
}

/** Stock shows on cached storefront pages, so a change drops the site's cache too. */
async function changed(slug: string, siteId: string, productId: string, variantId: string) {
  revalidatePath(`/${slug}/products/inventory`);
  revalidatePath(`/${slug}/products/${productId}`);
  revalidatePath(`/${slug}/products`);
  await Promise.all([emitEntity(siteId, "inventory_item", variantId), notifyRevalidate(slug, [])]);
}

/** Variants imported without stock have no row yet; the first edit creates it. */
async function ensureItem(tx: Tx, variantId: string) {
  await tx.insert(inventoryItem).values({ variantId }).onConflictDoNothing({ target: inventoryItem.variantId });
  const [row] = await tx
    .select({ id: inventoryItem.id, quantity: inventoryItem.quantity })
    .from(inventoryItem)
    .where(eq(inventoryItem.variantId, variantId))
    .for("update");
  return row!;
}

/** Compare-and-set: only applies when the stock is still `expected`, else returns the current value. */
export async function setQuantity(input: { site: string; variantId: string; expected: number; next: number }): Promise<StockResult> {
  const { site, siteId, user } = await requireSite(input.site);
  const t = await errors();
  const parsed = z.object({ expected: qty, next: qty }).safeParse(input);
  if (!parsed.success) return { ok: false, error: t("quantity", { max: MAX }) };
  const variant = await variantOf(siteId, input.variantId);
  if (!variant) return { ok: false, error: t("notFound") };
  const { expected, next } = parsed.data;

  const result = await db.transaction(async (tx): Promise<StockResult> => {
    const item = await ensureItem(tx, input.variantId);
    if (item.quantity !== expected) return { ok: false, error: t("race", { quantity: item.quantity }), quantity: item.quantity };
    if (next === expected) return { ok: true, quantity: next };
    const [updated] = await tx
      .update(inventoryItem)
      .set({ quantity: next })
      .where(and(eq(inventoryItem.id, item.id), eq(inventoryItem.quantity, expected)))
      .returning({ id: inventoryItem.id });
    if (!updated) return { ok: false, error: t("race", { quantity: item.quantity }), quantity: item.quantity };
    await tx.insert(inventoryHistory).values({ inventoryItemId: item.id, adjustment: next - expected, reason: "ADJUSTMENT", createdBy: user.id });
    return { ok: true, quantity: next };
  });
  if (result.ok && next !== expected) await changed(site.slug, siteId, variant.productId, input.variantId);
  return result;
}

const reasons = ["RESTOCK", "RETURN", "ADJUSTMENT", "DAMAGED"] as const;
export type AdjustReason = (typeof reasons)[number];

/** Records a delta with a reason. Stock never goes below zero; history keeps what was actually applied. */
export async function adjustStock(input: { site: string; variantId: string; delta: number; reason: AdjustReason; note?: string }): Promise<StockResult> {
  const { site, siteId, user } = await requireSite(input.site);
  const t = await errors();
  const parsed = z
    .object({
      delta: z.number().int().min(-MAX).max(MAX).refine((v) => v !== 0),
      reason: z.enum(reasons),
      note: z.string().trim().max(500).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.some((i) => i.path[0] === "note") ? t("note") : t("amount") };
  const variant = await variantOf(siteId, input.variantId);
  if (!variant) return { ok: false, error: t("notFound") };
  const { delta, reason, note } = parsed.data;

  const result = await db.transaction(async (tx) => {
    const item = await ensureItem(tx, input.variantId);
    const next = Math.min(Math.max(item.quantity + delta, 0), MAX);
    const applied = next - item.quantity;
    if (applied === 0) return { quantity: next, applied };
    await tx.update(inventoryItem).set({ quantity: next }).where(eq(inventoryItem.id, item.id));
    await tx.insert(inventoryHistory).values({
      inventoryItemId: item.id,
      adjustment: applied,
      reason: reason === "DAMAGED" ? "ADJUSTMENT" : reason,
      // Damaged or lost has no enum value of its own; the reference type tells it apart from a correction.
      referenceType: reason === "DAMAGED" ? "damaged" : note ? "note" : null,
      referenceId: note || null,
      createdBy: user.id,
    });
    return { quantity: next, applied };
  });
  if (result.applied === 0) return { ok: false, error: t("nothingToRemove"), quantity: result.quantity };
  await changed(site.slug, siteId, variant.productId, input.variantId);
  return { ok: true, quantity: result.quantity };
}

export type ItemSettings = { lowStockThreshold: number; tracked: boolean; supplier?: string; storageLocation?: string };

export async function updateItem(input: { site: string; variantId: string } & ItemSettings): Promise<{ ok: true } | { ok: false; error: string }> {
  const { site, siteId } = await requireSite(input.site);
  const t = await errors();
  const parsed = z
    .object({
      lowStockThreshold: z.number().int().min(0).max(MAX),
      tracked: z.boolean(),
      supplier: z.string().trim().max(200).optional(),
      storageLocation: z.string().trim().max(200).optional(),
    })
    .safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { ok: false, error: field === "lowStockThreshold" ? t("threshold") : t("tooLong", { max: 200 }) };
  }
  const variant = await variantOf(siteId, input.variantId);
  if (!variant) return { ok: false, error: t("notFound") };
  const { lowStockThreshold, tracked, supplier, storageLocation } = parsed.data;
  const values = {
    lowStockThreshold,
    tracked,
    ...(supplier !== undefined ? { supplier: supplier || null } : {}),
    ...(storageLocation !== undefined ? { storageLocation: storageLocation || null } : {}),
  };
  await db
    .insert(inventoryItem)
    .values({ variantId: input.variantId, ...values })
    .onConflictDoUpdate({ target: inventoryItem.variantId, set: values });
  await changed(site.slug, siteId, variant.productId, input.variantId);
  return { ok: true };
}

/** Sheet data, loaded when an item is opened. */
export async function loadItem(input: { site: string; variantId: string }): Promise<{ ok: true; item: InventoryDetail } | { ok: false; error: string }> {
  const { siteId } = await requireSite(input.site);
  const t = await errors();
  const item = z.guid().safeParse(input.variantId).success ? await getInventoryDetail(siteId, input.variantId) : null;
  return item ? { ok: true, item } : { ok: false, error: t("notFound") };
}
