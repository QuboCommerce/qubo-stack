import { baseCss, compileTheme, ThemeSchema, type CompileOptions } from "@qubo/stylekit";
import { document, page, sectionGroup, site, template, translation } from "@qubo/db/schema";
import { and, asc, eq, ne } from "drizzle-orm";
import { db, type Scope } from "./db";
import { createDocument, getDocument } from "./documents";
import { NotFoundError, StudioError, ValidationError } from "./errors";
import { getLiveTheme } from "./themes";
import type { ResourceKind } from "./views";

const HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG = /^[a-z0-9]+(?:[-/][a-z0-9]+)*$/;

// ------------------------------------------------------------- templates ---

/**
 * Alternate template (Shopify's `product.refrigerated-display`), created as a
 * copy of the kind's default so the merchant starts from what they know.
 */
export async function createTemplate(
  scope: Scope,
  input: { resourceKind: ResourceKind; handle: string; name: string; copyFromTemplateId?: string },
) {
  const handle = input.handle.trim().toLowerCase();
  if (!HANDLE.test(handle) || handle === "default") {
    throw new ValidationError([{ path: "handle", message: "Use lowercase letters, numbers and dashes (not “default”)." }]);
  }
  const source = input.copyFromTemplateId
    ? await db.select().from(template).where(and(eq(template.id, input.copyFromTemplateId), eq(template.siteId, scope.siteId))).limit(1)
    : await db
        .select()
        .from(template)
        .where(and(eq(template.siteId, scope.siteId), eq(template.resourceKind, input.resourceKind), eq(template.handle, "default")))
        .limit(1);
  if (source[0]?.isSystem) throw new StudioError("forbidden", "System templates can't have alternates.");
  const base = source[0] ? await getDocument(scope, source[0].documentId) : null;

  return db.transaction(async (tx) => {
    const dup = await tx
      .select({ id: template.id })
      .from(template)
      .where(and(eq(template.siteId, scope.siteId), eq(template.resourceKind, input.resourceKind), eq(template.handle, handle)));
    if (dup.length) throw new ValidationError([{ path: "handle", message: "A template with this name already exists." }]);
    const doc = await createDocument(scope, { kind: "template", data: base?.draft }, tx);
    const [row] = await tx
      .insert(template)
      .values({ siteId: scope.siteId, resourceKind: input.resourceKind, handle, name: input.name.trim() || handle, documentId: doc.id })
      .returning();
    return row!;
  });
}

/** Only alternates can be deleted; defaults and system templates are permanent. */
export async function deleteTemplate(scope: Scope, templateId: string) {
  const [row] = await db
    .select()
    .from(template)
    .where(and(eq(template.id, templateId), eq(template.siteId, scope.siteId)))
    .limit(1);
  if (!row) throw new NotFoundError("Template");
  if (row.isSystem || row.handle === "default") throw new StudioError("forbidden", "Default and system templates can't be deleted.");
  const inUse =
    row.resourceKind === "page" &&
    (await db
      .select({ id: page.id })
      .from(page)
      .where(and(eq(page.siteId, scope.siteId), eq(page.templateHandle, row.handle)))
      .limit(1)).length > 0;
  if (inUse) {
    throw new StudioError("conflict", "Pages still use this template; switch them first.");
  }
  await db.transaction(async (tx) => {
    await tx.delete(template).where(eq(template.id, row.id));
    await tx.delete(translation).where(eq(translation.ownerRef, `document:${row.documentId}`));
    await tx.delete(document).where(eq(document.id, row.documentId));
  });
}

// ----------------------------------------------------------------- pages ---

async function primaryLocale(siteId: string) {
  const [s] = await db.select({ locale: site.locale }).from(site).where(eq(site.id, siteId));
  if (!s) throw new NotFoundError("Site");
  return s.locale;
}

function normaliseSlug(raw: string) {
  const slug = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9/]+/g, "-")
    .replace(/^[-/]+|[-/]+$/g, "");
  if (!SLUG.test(slug)) throw new ValidationError([{ path: "slug", message: "Use letters, numbers and dashes." }]);
  return slug;
}

/** A content page; its sections start as a copy of the page template. */
export async function createPage(
  scope: Scope,
  input: { title: string; slug?: string; templateHandle?: string | null; metaDescription?: string },
) {
  const title = input.title.trim();
  if (!title) throw new ValidationError([{ path: "title", message: "Give the page a title." }]);
  const slug = normaliseSlug(input.slug || title);
  const locale = await primaryLocale(scope.siteId);
  const [tpl] = await db
    .select({ documentId: template.documentId })
    .from(template)
    .where(and(eq(template.siteId, scope.siteId), eq(template.resourceKind, "page"), eq(template.handle, input.templateHandle || "default")))
    .limit(1);
  const starter = tpl ? (await getDocument(scope, tpl.documentId)).draft : undefined;

  return db.transaction(async (tx) => {
    const taken = await tx
      .select({ id: page.id })
      .from(page)
      .where(and(eq(page.siteId, scope.siteId), eq(page.locale, locale), eq(page.slug, slug)));
    if (taken.length) throw new ValidationError([{ path: "slug", message: `/${slug} is already in use.` }]);
    const doc = await createDocument(scope, { kind: "page", data: starter }, tx);
    const [row] = await tx
      .insert(page)
      .values({
        siteId: scope.siteId,
        title,
        slug,
        locale,
        state: "DRAFT",
        documentId: doc.id,
        templateHandle: input.templateHandle && input.templateHandle !== "default" ? input.templateHandle : null,
        metaDescription: input.metaDescription?.trim() || null,
      })
      .returning();
    return row!;
  });
}

export async function updatePage(
  scope: Scope,
  id: string,
  input: { title?: string; slug?: string; metaTitle?: string | null; metaDescription?: string | null; templateHandle?: string | null },
) {
  const [row] = await db.select().from(page).where(and(eq(page.id, id), eq(page.siteId, scope.siteId))).limit(1);
  if (!row) throw new NotFoundError("Page");
  const slug = input.slug != null ? normaliseSlug(input.slug) : row.slug;
  if (slug !== row.slug) {
    const taken = await db
      .select({ id: page.id })
      .from(page)
      .where(and(eq(page.siteId, scope.siteId), eq(page.locale, row.locale), eq(page.slug, slug), ne(page.id, id)));
    if (taken.length) throw new ValidationError([{ path: "slug", message: `/${slug} is already in use.` }]);
  }
  const [updated] = await db
    .update(page)
    .set({
      title: input.title?.trim() || row.title,
      slug,
      metaTitle: input.metaTitle === undefined ? row.metaTitle : input.metaTitle?.trim() || null,
      metaDescription: input.metaDescription === undefined ? row.metaDescription : input.metaDescription?.trim() || null,
      templateHandle: input.templateHandle === undefined ? row.templateHandle : input.templateHandle || null,
      updatedAt: new Date(),
    })
    .where(eq(page.id, id))
    .returning();
  return updated!;
}

export async function deletePage(scope: Scope, id: string) {
  const [row] = await db.select().from(page).where(and(eq(page.id, id), eq(page.siteId, scope.siteId))).limit(1);
  if (!row) throw new NotFoundError("Page");
  if (row.isHomepage) throw new StudioError("forbidden", "The homepage can't be deleted.");
  await db.transaction(async (tx) => {
    await tx.delete(page).where(eq(page.id, id));
    if (row.documentId) {
      await tx.delete(translation).where(eq(translation.ownerRef, `document:${row.documentId}`));
      await tx.delete(document).where(eq(document.id, row.documentId));
    }
  });
}

export async function listPages(scope: Scope) {
  return db.select().from(page).where(eq(page.siteId, scope.siteId)).orderBy(asc(page.title));
}

export async function listSectionGroups(scope: Scope) {
  return db.select().from(sectionGroup).where(eq(sectionGroup.siteId, scope.siteId));
}

// ------------------------------------------------------------- theme CSS ---

/**
 * The live theme as CSS (base layer + tokens). `hash` changes with content,
 * so storefronts can cache `/theme.css?v=<hash>` forever.
 */
export async function liveThemeCss(siteId: string, opts: CompileOptions = {}) {
  const input = await getLiveTheme(siteId);
  if (!input) return null;
  const theme = ThemeSchema.parse(input);
  const compiled = compileTheme(theme, opts);
  return { themeId: theme.id, css: `${baseCss}\n${compiled.css}`, hash: compiled.hash };
}
