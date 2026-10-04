/**
 * Creating organisations and sites. A site is born complete: capabilities,
 * locales, every template of its preset (published), header and footer
 * groups, an active theme and a contact form, so the storefront renders
 * on the first request and Studio has something to edit.
 */
import { db } from "@qubo/db/client";
import { document, documentRevision, form, organization, organizationMember, sectionGroup, site, siteLocale, siteSettings, template, theme } from "@qubo/db/schema";
import { registry } from "@qubo/blocks";
import type { SiteType } from "@qubo/blocks/core";
import { siteTypePresets, templateStarter } from "@qubo/blocks/presets";
import { builtInThemes, diagnoseTheme } from "@qubo/stylekit";
import { eq, like, or } from "drizzle-orm";
import { ValidationError } from "./errors";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const SITE_LOCALES = ["fr-BE", "nl-BE", "en", "de", "fr", "nl"] as const;

/** First theme a site gets, by what it's for. Easy to swap in Studio. */
const themeForType: Record<SiteType, keyof typeof builtInThemes> = {
  store: "smossie",
  services: "lume",
  business: "hm-froid",
  editorial: "lume",
  custom: "smossie",
};

export function slugify(raw: string) {
  return raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** `name`, then `name-2`, `name-3`... among the slugs already taken. */
export function uniqueSlug(base: string, taken: Iterable<string>) {
  const set = new Set(taken);
  const root = base || "site";
  if (!set.has(root)) return root;
  for (let i = 2; ; i++) if (!set.has(`${root}-${i}`)) return `${root}-${i}`;
}

async function freeSlug(tx: Tx, table: typeof site | typeof organization, base: string) {
  const rows = await tx
    .select({ slug: table.slug })
    .from(table)
    .where(or(eq(table.slug, base), like(table.slug, `${base}-%`)));
  return uniqueSlug(base, rows.map((r) => r.slug));
}

export async function createOrganization(input: { name: string; legalName?: string | null; companyNumber?: string | null; userId: string }) {
  const name = input.name.trim();
  if (name.length < 2) throw new ValidationError([{ path: "name", message: "Give the organisation a name." }]);
  return db.transaction(async (tx) => {
    const slug = await freeSlug(tx, organization, slugify(name));
    const [org] = await tx
      .insert(organization)
      .values({ name, slug, legalName: input.legalName?.trim() || null, companyNumber: input.companyNumber?.trim() || null })
      .returning({ id: organization.id, slug: organization.slug, name: organization.name });
    await tx.insert(organizationMember).values({ organizationId: org!.id, userId: input.userId, role: "OWNER" });
    return org!;
  });
}

async function publishedDocument(tx: Tx, siteId: string, kind: "template" | "section_group", data: unknown, userId: string) {
  const [doc] = await tx
    .insert(document)
    .values({ siteId, kind, draftData: data, publishedData: data, publishedAt: new Date(), updatedById: userId })
    .returning({ id: document.id });
  const [rev] = await tx
    .insert(documentRevision)
    .values({ documentId: doc!.id, version: 1, kind: "publish", data, label: "Initial" })
    .returning({ id: documentRevision.id });
  await tx.update(document).set({ publishedRevisionId: rev!.id }).where(eq(document.id, doc!.id));
  return doc!.id;
}

export async function createSite(input: { organizationId: string; name: string; type: SiteType; locale: string; currency?: string; userId: string }) {
  const name = input.name.trim();
  if (name.length < 2) throw new ValidationError([{ path: "name", message: "Give the site a name." }]);
  const preset = siteTypePresets[input.type];
  if (!preset) throw new ValidationError([{ path: "type", message: "Pick what the site is for." }]);
  if (!(SITE_LOCALES as readonly string[]).includes(input.locale)) throw new ValidationError([{ path: "locale", message: "Pick a language." }]);
  const themeInput = builtInThemes[themeForType[input.type]] ?? builtInThemes.smossie!;

  return db.transaction(async (tx) => {
    const slug = await freeSlug(tx, site, slugify(name));
    const [row] = await tx
      .insert(site)
      .values({
        organizationId: input.organizationId,
        name,
        slug,
        type: input.type,
        capabilities: preset.capabilities,
        ownerId: input.userId,
        currency: input.currency ?? "EUR",
        locale: input.locale,
      })
      .returning({ id: site.id, slug: site.slug, name: site.name });
    const siteId = row!.id;
    await tx.insert(siteSettings).values({ siteId });
    await tx.insert(siteLocale).values({ siteId, locale: input.locale, isPrimary: true, isPublished: true });
    for (const t of preset.templates) {
      const documentId = await publishedDocument(tx, siteId, "template", templateStarter(t.kind, registry), input.userId);
      await tx.insert(template).values({ siteId, resourceKind: t.kind, name: t.name, isSystem: !!t.isSystem, documentId });
    }
    for (const kind of ["header", "footer"] as const) {
      const documentId = await publishedDocument(tx, siteId, "section_group", { root: { props: {} }, content: [] }, input.userId);
      await tx.insert(sectionGroup).values({ siteId, kind, documentId });
    }
    const report = diagnoseTheme(themeInput);
    await tx.insert(theme).values({
      siteId,
      name: themeInput.name,
      isActive: true,
      draft: themeInput,
      published: themeInput,
      publishedAt: new Date(),
      health: report.health,
      richness: report.richness.tier,
    });
    await tx.insert(form).values({ siteId, key: "contact", name: "Contact" });
    return row!;
  });
}
