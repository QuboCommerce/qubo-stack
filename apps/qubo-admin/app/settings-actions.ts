"use server";

import { db } from "@qubo/db/client";
import { organization, site as siteTable, siteLocale, siteSettings } from "@qubo/db/schema";
import { capabilities, siteTypes } from "@qubo/blocks";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSiteFromForm } from "@/lib/admin";
import type { ActionState } from "@/lib/action-state";
import { supportedLocales } from "@/lib/format";
import { emitEntity } from "@/lib/events";
import { businessSpec, businessValues, siteGeneralSpec, siteGeneralValues } from "@/lib/form-specs";
import { hoursFromForm } from "@/lib/opening-hours";
import { RACE, reconcile, unchangedSince } from "@/lib/merge-server";
import { siteTypePresets } from "@qubo/blocks/presets";
import { notifyRevalidate } from "@qubo/studio";
import { capabilityMeta } from "@/components/settings/capabilities";

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

export async function updateSiteGeneral(_prev: ActionState, submitted: FormData): Promise<ActionState> {
  try {
    const { siteId, site } = await requireManager(submitted);
    const [row] = await db.select().from(siteTable).where(eq(siteTable.id, siteId)).limit(1);
    if (!row) return { error: "Site not found." };
    const spec = siteGeneralSpec({
      type: (t) => siteTypePresets[t as keyof typeof siteTypePresets]?.label ?? t,
      capability: (c) => capabilityMeta[c]?.label ?? c,
    });
    const r = await reconcile(submitted, spec, siteGeneralValues(row), { siteId, table: "site", id: siteId });
    if ("conflict" in r) return { conflict: r.conflict };
    const formData = r.formData;
    const parsed = generalSchema.safeParse({
      name: formData.get("name"),
      description: formData.get("description") ?? "",
      currency: formData.get("currency"),
      type: formData.get("type"),
      capabilities: formData.getAll("capabilities"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
    const data = parsed.data;
    const saved = await db
      .update(siteTable)
      .set({ ...data, description: data.description || null, updatedAt: new Date() })
      .where(and(eq(siteTable.id, siteId), unchangedSince(siteTable.updatedAt, row.updatedAt)))
      .returning({ id: siteTable.id });
    if (!saved.length) return { error: RACE };
    await emitEntity(siteId, "site", siteId);
    refresh(site.slug);
    return { ok: true, at: Date.now() };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

const optional = (max: number, what: string) => z.string().trim().max(max, `${what} is limited to ${max} characters.`).optional().default("");
const coordinate = (min: number, max: number, what: string) =>
  z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= max), `${what} must be a number between ${min} and ${max}.`);

const businessSchema = z.object({
  metaTitle: optional(120, "Site title"),
  metaDescription: optional(320, "Site description"),
  phone: optional(40, "Phone"),
  email: z.string().trim().max(120).optional().default("").refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email address."),
  businessType: z.string().trim().regex(/^[A-Za-z]*$/, "Business type must be a schema.org type name.").max(60).optional().default(""),
  latitude: coordinate(-90, 90, "Latitude"),
  longitude: coordinate(-180, 180, "Longitude"),
  legalName: optional(160, "Legal name"),
  legalForm: optional(40, "Legal form"),
  companyNumber: optional(40, "Company number"),
  vatNumber: optional(40, "VAT number"),
  addressLine1: optional(160, "Address"),
  addressLine2: optional(160, "Address line 2"),
  postalCode: optional(20, "Postal code"),
  city: optional(80, "City"),
  country: z.string().trim().toUpperCase().regex(/^([A-Z]{2})?$/, "Country is the two-letter ISO code, e.g. BE.").optional().default(""),
});

const orNull = (v: string) => v || null;

/** Business & SEO: the site's public contact details and the organisation's legal identity (shared by its sites). */
export async function updateSiteBusiness(_prev: ActionState, submitted: FormData): Promise<ActionState> {
  try {
    const { siteId, site } = await requireManager(submitted);
    const [settings, org] = await Promise.all([
      db.query.siteSettings.findFirst({ where: eq(siteSettings.siteId, siteId) }),
      db.query.organization.findFirst({ where: eq(organization.id, site.organizationId) }),
    ]);
    if (!org) return { error: "Organisation not found." };
    const r = await reconcile(submitted, businessSpec(), businessValues(settings, org), { siteId, table: "site_settings", id: siteId });
    if ("conflict" in r) return { conflict: r.conflict };
    const formData = r.formData;
    const get = (name: string) => String(formData.get(name) ?? "");
    const parsed = businessSchema.safeParse(Object.fromEntries(Object.keys(businessSchema.shape).map((k) => [k, get(k)])));
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
    const d = parsed.data;
    if ((d.latitude === "") !== (d.longitude === "")) return { error: "Enter both latitude and longitude, or neither." };
    const openingHours = hoursFromForm(get);
    const now = new Date();
    const settingsValues = {
      metaTitle: orNull(d.metaTitle),
      metaDescription: orNull(d.metaDescription),
      phone: orNull(d.phone),
      email: orNull(d.email),
      businessType: orNull(d.businessType),
      latitude: orNull(d.latitude),
      longitude: orNull(d.longitude),
      openingHours,
      updatedAt: now,
    };
    if (settings) {
      const saved = await db
        .update(siteSettings)
        .set(settingsValues)
        .where(and(eq(siteSettings.siteId, siteId), unchangedSince(siteSettings.updatedAt, settings.updatedAt)))
        .returning({ id: siteSettings.id });
      if (!saved.length) return { error: RACE };
    } else {
      await db.insert(siteSettings).values({ siteId, ...settingsValues }).onConflictDoNothing();
    }
    await db
      .update(organization)
      .set({
        legalName: orNull(d.legalName),
        legalForm: orNull(d.legalForm),
        companyNumber: orNull(d.companyNumber),
        vatNumber: orNull(d.vatNumber),
        addressLine1: orNull(d.addressLine1),
        addressLine2: orNull(d.addressLine2),
        postalCode: orNull(d.postalCode),
        city: orNull(d.city),
        country: orNull(d.country),
        updatedAt: now,
      })
      .where(eq(organization.id, org.id));
    await emitEntity(siteId, "site_settings", siteId);
    await notifyRevalidate(site.slug, []);
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
