"use server";

import { db } from "@qubo/db/client";
import { organization, site as siteTable, siteLocale, siteSettings } from "@qubo/db/schema";
import { capabilities, siteTypes } from "@qubo/blocks";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
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

/** Only organization owners/admins may change site settings. */
async function requireManager(formData: FormData) {
  const ctx = await requireSiteFromForm(formData);
  if (ctx.site.memberRole !== "OWNER" && ctx.site.memberRole !== "ADMIN") throw new Error((await getTranslations("settings"))("actions.noPermission"));
  return ctx;
}

const refresh = (slug: string) => revalidatePath(`/${slug}`, "layout");

type T = Awaited<ReturnType<typeof getTranslations<"settings">>>;

const generalSchema = (t: T) =>
  z.object({
  name: z.string().trim().min(2, t("actions.nameMin")).max(80, t("actions.nameMax")),
  description: z.string().trim().max(300, t("actions.descriptionMax")).optional().default(""),
  currency: z.enum(["EUR", "USD", "GBP", "CHF"]),
  type: z.enum(siteTypes),
  capabilities: z.array(z.enum(capabilities)),
  });

export async function updateSiteGeneral(_prev: ActionState, submitted: FormData): Promise<ActionState> {
  const t = await getTranslations("settings");
  try {
    const { siteId, site } = await requireManager(submitted);
    const [row] = await db.select().from(siteTable).where(eq(siteTable.id, siteId)).limit(1);
    if (!row) return { error: t("actions.siteNotFound") };
    const spec = siteGeneralSpec(
      {
        type: (type) => (type in siteTypePresets ? t(`siteTypes.${type as keyof typeof siteTypePresets}.label`) : type),
        capability: (c) => ((capabilities as readonly string[]).includes(c) ? t(`capabilities.${c as (typeof capabilities)[number]}.label`) : c),
      },
      t,
    );
    const r = await reconcile(submitted, spec, siteGeneralValues(row), { siteId, table: "site", id: siteId });
    if ("conflict" in r) return { conflict: r.conflict };
    const formData = r.formData;
    const parsed = generalSchema(t).safeParse({
      name: formData.get("name"),
      description: formData.get("description") ?? "",
      currency: formData.get("currency"),
      type: formData.get("type"),
      capabilities: formData.getAll("capabilities"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("actions.checkFields") };
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
    return { error: e instanceof Error ? e.message : t("actions.generic") };
  }
}

const businessSchema = (t: T) => {
  const optional = (max: number, what: Parameters<T>[0] & `fields.${string}`) =>
    z.string().trim().max(max, t("actions.limited", { what: t(what), max })).optional().default("");
  const coordinate = (min: number, max: number, what: "fields.latitude" | "fields.longitude") =>
  z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= max), t("actions.coordinate", { what: t(what), min, max }));

  return z.object({
  metaTitle: optional(120, "fields.siteTitle"),
  metaDescription: optional(320, "fields.siteDescription"),
  phone: optional(40, "fields.phone"),
  email: z.string().trim().max(120).optional().default("").refine((v) => v === "" || z.string().email().safeParse(v).success, t("actions.emailInvalid")),
  businessType: z.string().trim().regex(/^[A-Za-z]*$/, t("actions.businessType")).max(60).optional().default(""),
  latitude: coordinate(-90, 90, "fields.latitude"),
  longitude: coordinate(-180, 180, "fields.longitude"),
  legalName: optional(160, "fields.legalName"),
  legalForm: optional(40, "fields.legalForm"),
  companyNumber: optional(40, "fields.companyNumber"),
  vatNumber: optional(40, "fields.vatNumber"),
  addressLine1: optional(160, "fields.address"),
  addressLine2: optional(160, "fields.addressLine2"),
  postalCode: optional(20, "fields.postalCode"),
  city: optional(80, "fields.city"),
  country: z.string().trim().toUpperCase().regex(/^([A-Z]{2})?$/, t("actions.country", { example: "BE" })).optional().default(""),
  });
};

const orNull = (v: string) => v || null;

/** Business & SEO: the site's public contact details and the organisation's legal identity (shared by its sites). */
export async function updateSiteBusiness(_prev: ActionState, submitted: FormData): Promise<ActionState> {
  const t = await getTranslations("settings");
  try {
    const { siteId, site } = await requireManager(submitted);
    const [settings, org] = await Promise.all([
      db.query.siteSettings.findFirst({ where: eq(siteSettings.siteId, siteId) }),
      db.query.organization.findFirst({ where: eq(organization.id, site.organizationId) }),
    ]);
    if (!org) return { error: t("actions.orgNotFound") };
    const r = await reconcile(submitted, businessSpec(t), businessValues(settings, org), { siteId, table: "site_settings", id: siteId });
    if ("conflict" in r) return { conflict: r.conflict };
    const formData = r.formData;
    const get = (name: string) => String(formData.get(name) ?? "");
    const schema = businessSchema(t);
    const parsed = schema.safeParse(Object.fromEntries(Object.keys(schema.shape).map((k) => [k, get(k)])));
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("actions.checkFields") };
    const d = parsed.data;
    if ((d.latitude === "") !== (d.longitude === "")) return { error: t("actions.bothCoordinates") };
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
    return { error: e instanceof Error ? e.message : t("actions.generic") };
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
    if (!row) throw new Error((await getTranslations("settings"))("actions.addLanguageFirst"));
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
