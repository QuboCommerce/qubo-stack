"use server";

import { db } from "@qubo/db/client";
import { site as siteTable, siteLocale } from "@qubo/db/schema";
import { capabilities, siteTypes } from "@qubo/blocks";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSiteFromForm } from "@/lib/admin";
import type { ActionState } from "@/lib/action-state";
import { supportedLocales } from "@/lib/format";
import { emitEntity } from "@/lib/events";

/** Only organization owners/admins may change site settings. */
async function requireManager(formData: FormData) {
  const ctx = await requireSiteFromForm(formData);
  if (ctx.site.memberRole !== "OWNER" && ctx.site.memberRole !== "ADMIN") throw new Error("You don't have permission to change settings.");
  return ctx;
}

const refresh = (slug: string) => revalidatePath(`/${slug}`, "layout");

const generalSchema = z.object({
  name: z.string().trim().min(2, "Site name needs at least 2 characters.").max(80, "Site name is limited to 80 characters."),
  description: z.string().trim().max(300, "Description is limited to 300 characters.").optional().default(""),
  currency: z.enum(["EUR", "USD", "GBP", "CHF"]),
  type: z.enum(siteTypes),
  capabilities: z.array(z.enum(capabilities)),
});

export async function updateSiteGeneral(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { siteId, site } = await requireManager(formData);
    const parsed = generalSchema.safeParse({
      name: formData.get("name"),
      description: formData.get("description") ?? "",
      currency: formData.get("currency"),
      type: formData.get("type"),
      capabilities: formData.getAll("capabilities"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
    const data = parsed.data;
    await db
      .update(siteTable)
      .set({ ...data, description: data.description || null, updatedAt: new Date() })
      .where(eq(siteTable.id, siteId));
    await emitEntity(siteId, "site", siteId);
    refresh(site.slug);
    return { ok: true, at: Date.now() };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

const localeSchema = z.enum(supportedLocales);

export async function addLocale(formData: FormData) {
  const { siteId, site } = await requireManager(formData);
  const locale = localeSchema.parse(formData.get("locale"));
  await db.insert(siteLocale).values({ siteId, locale }).onConflictDoNothing();
  refresh(site.slug);
}

export async function setPrimaryLocale(formData: FormData) {
  const { siteId, site } = await requireManager(formData);
  const locale = localeSchema.parse(formData.get("locale"));
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(siteLocale).where(and(eq(siteLocale.siteId, siteId), eq(siteLocale.locale, locale)));
    if (!row) throw new Error("Add the language before making it primary.");
    await tx.update(siteLocale).set({ isPrimary: false }).where(and(eq(siteLocale.siteId, siteId), ne(siteLocale.locale, locale)));
    await tx.update(siteLocale).set({ isPrimary: true, isPublished: true }).where(eq(siteLocale.id, row.id));
    await tx.update(siteTable).set({ locale, updatedAt: new Date() }).where(eq(siteTable.id, siteId));
  });
  refresh(site.slug);
}

export async function toggleLocalePublished(formData: FormData) {
  const { siteId, site } = await requireManager(formData);
  const locale = localeSchema.parse(formData.get("locale"));
  const publish = formData.get("publish") === "true";
  await db
    .update(siteLocale)
    .set({ isPublished: publish })
    .where(and(eq(siteLocale.siteId, siteId), eq(siteLocale.locale, locale), eq(siteLocale.isPrimary, false)));
  refresh(site.slug);
}

/** Translations stay in the database; re-adding the language restores them. */
export async function removeLocale(formData: FormData) {
  const { siteId, site } = await requireManager(formData);
  const locale = localeSchema.parse(formData.get("locale"));
  await db
    .delete(siteLocale)
    .where(and(eq(siteLocale.siteId, siteId), eq(siteLocale.locale, locale), eq(siteLocale.isPrimary, false)));
  refresh(site.slug);
}
