import { registry, applyTranslations, type DocumentData } from "@qubo/blocks";
import { document, siteLocale, translation } from "@qubo/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { splitTranslationPath, stringsOf, translationPath } from "./content";
import { db, type Scope } from "./db";
import { NotFoundError, ValidationError } from "./errors";

export type TranslationStatus = (typeof translation.$inferSelect)["status"];

export type TranslationRow = {
  /** `<nodeId>.<fieldPath>` */
  path: string;
  nodeId: string;
  blockType: string;
  kind: "text" | "richtext" | "alt";
  source: string;
  value: string | null;
  status: TranslationStatus;
};

async function ownedDocument(scope: Scope, id: string) {
  const [row] = await db
    .select({ id: document.id, draft: document.draftData, published: document.publishedData })
    .from(document)
    .where(and(eq(document.id, id), eq(document.siteId, scope.siteId)))
    .limit(1);
  if (!row) throw new NotFoundError();
  return row;
}

async function assertLocale(scope: Scope, locale: string) {
  const [row] = await db
    .select({ isPrimary: siteLocale.isPrimary })
    .from(siteLocale)
    .where(and(eq(siteLocale.siteId, scope.siteId), eq(siteLocale.locale, locale)))
    .limit(1);
  if (!row) throw new ValidationError([{ path: "locale", message: `${locale} is not enabled for this site.` }]);
  if (row.isPrimary) throw new ValidationError([{ path: "locale", message: "The primary language is edited in place." }]);
}

/**
 * Every translatable leaf of a document's draft, joined with its translation
 * in `locale`. Drives the component inspector's translation column.
 */
export async function listDocumentTranslations(scope: Scope, documentId: string, locale: string): Promise<TranslationRow[]> {
  const doc = await ownedDocument(scope, documentId);
  const rows = await db
    .select({ path: translation.path, value: translation.value, status: translation.status, sourceHash: translation.sourceHash })
    .from(translation)
    .where(
      and(
        eq(translation.siteId, scope.siteId),
        eq(translation.ownerRef, `document:${documentId}`),
        eq(translation.locale, locale),
      ),
    );
  const byPath = new Map(rows.map((r) => [r.path, r]));
  return stringsOf(doc.draft as DocumentData).map((s) => {
    const path = translationPath(s.nodeId, s.path);
    const t = byPath.get(path);
    const status: TranslationStatus = !t ? "missing" : t.sourceHash !== s.sourceHash ? "stale" : t.status;
    return { path, nodeId: s.nodeId, blockType: s.type, kind: s.kind, source: s.value, value: t?.value ?? null, status };
  });
}

/** Writes translations for leaves that exist in the current draft. */
export async function upsertDocumentTranslations(
  scope: Scope,
  input: { documentId: string; locale: string; entries: { path: string; value: string; status?: "draft" | "done" }[] },
) {
  await assertLocale(scope, input.locale);
  const doc = await ownedDocument(scope, input.documentId);
  const sources = new Map(stringsOf(doc.draft as DocumentData).map((s) => [translationPath(s.nodeId, s.path), s.sourceHash]));
  const unknown = input.entries.filter((e) => !sources.has(e.path));
  if (unknown.length) {
    throw new ValidationError(unknown.map((e) => ({ path: e.path, message: "No translatable text at this path." })));
  }
  const ownerRef = `document:${input.documentId}`;
  const empty = input.entries.filter((e) => !e.value.trim()).map((e) => e.path);
  const filled = input.entries.filter((e) => e.value.trim());
  await db.transaction(async (tx) => {
    if (empty.length) {
      await tx
        .delete(translation)
        .where(and(eq(translation.ownerRef, ownerRef), eq(translation.locale, input.locale), inArray(translation.path, empty)));
    }
    for (const e of filled) {
      const values = {
        siteId: scope.siteId,
        ownerRef,
        path: e.path,
        locale: input.locale,
        value: e.value,
        sourceHash: sources.get(e.path)!,
        status: e.status ?? ("done" as const),
        updatedAt: new Date(),
      };
      await tx
        .insert(translation)
        .values(values)
        .onConflictDoUpdate({
          target: [translation.ownerRef, translation.path, translation.locale],
          set: { value: values.value, sourceHash: values.sourceHash, status: values.status, updatedAt: values.updatedAt },
        });
    }
  });
  return { saved: filled.length, cleared: empty.length };
}

/** Completion per locale for a document: `{ "nl-BE": { done: 4, total: 9, stale: 1 } }`. */
export async function translationProgress(scope: Scope, documentId: string) {
  const locales = await db
    .select({ locale: siteLocale.locale })
    .from(siteLocale)
    .where(and(eq(siteLocale.siteId, scope.siteId), eq(siteLocale.isPrimary, false)));
  const out: Record<string, { done: number; stale: number; total: number }> = {};
  for (const { locale } of locales) {
    const rows = await listDocumentTranslations(scope, documentId, locale);
    out[locale] = {
      done: rows.filter((r) => r.status === "done" || r.status === "draft").length,
      stale: rows.filter((r) => r.status === "stale").length,
      total: rows.length,
    };
  }
  return out;
}

export type TranslationCoverage = { done: number; stale: number; total: number };

/**
 * Site-wide completion per non-primary locale over every document's draft, in
 * two queries: `{ "nl-BE": { done: 40, stale: 2, total: 120 } }`. `done`
 * counts current translations only; stale ones are counted apart.
 */
export async function translationCoverage(siteId: string): Promise<Record<string, TranslationCoverage>> {
  const [locales, docs, rows] = await Promise.all([
    db.select({ locale: siteLocale.locale }).from(siteLocale).where(and(eq(siteLocale.siteId, siteId), eq(siteLocale.isPrimary, false))),
    db.select({ id: document.id, draft: document.draftData }).from(document).where(eq(document.siteId, siteId)),
    db
      .select({ ownerRef: translation.ownerRef, path: translation.path, locale: translation.locale, status: translation.status, sourceHash: translation.sourceHash })
      .from(translation)
      .where(eq(translation.siteId, siteId)),
  ]);
  const byKey = new Map(rows.map((r) => [`${r.locale}|${r.ownerRef}|${r.path}`, r]));
  const out: Record<string, TranslationCoverage> = {};
  for (const { locale } of locales) out[locale] = { done: 0, stale: 0, total: 0 };
  for (const d of docs) {
    for (const str of stringsOf(d.draft as DocumentData)) {
      const path = translationPath(str.nodeId, str.path);
      for (const locale of Object.keys(out)) {
        const c = out[locale]!;
        c.total++;
        const t = byKey.get(`${locale}|document:${d.id}|${path}`);
        if (!t) continue;
        if (t.sourceHash !== str.sourceHash || t.status === "stale") c.stale++;
        else c.done++;
      }
    }
  }
  return out;
}

/**
 * Storefront read: published tree with the locale overlay applied. Stale
 * translations still render (better than falling back mid-sentence).
 * `draft` (site preview) reads the saved draft instead, falling back to published.
 */
export async function renderableDocument(siteId: string, documentId: string, locale?: string, opts: { draft?: boolean } = {}): Promise<DocumentData | null> {
  const [row] = await db
    .select({ published: document.publishedData, draft: document.draftData })
    .from(document)
    .where(and(eq(document.id, documentId), eq(document.siteId, siteId)))
    .limit(1);
  const data = ((opts.draft ? (row?.draft ?? row?.published) : row?.published) as DocumentData | null) ?? null;
  if (!data || !locale) return data;
  const rows = await db
    .select({ path: translation.path, value: translation.value })
    .from(translation)
    .where(and(eq(translation.siteId, siteId), eq(translation.ownerRef, `document:${documentId}`), eq(translation.locale, locale)));
  return applyTranslations(
    data,
    registry,
    rows.map((r) => ({ ...splitTranslationPath(r.path), value: r.value })),
  );
}

/** Every stale translation on the site, newest first — the "needs review" queue. */
export async function listStaleTranslations(scope: Scope, locale?: string) {
  return db
    .select({ ownerRef: translation.ownerRef, path: translation.path, locale: translation.locale, value: translation.value, updatedAt: translation.updatedAt })
    .from(translation)
    .where(
      and(
        eq(translation.siteId, scope.siteId),
        eq(translation.status, "stale"),
        locale ? eq(translation.locale, locale) : undefined,
      ),
    )
    .orderBy(desc(translation.updatedAt))
    .limit(500);
}
