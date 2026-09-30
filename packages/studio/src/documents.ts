import { asset, assetUsage, document, documentRevision, page, site, translation, user } from "@peltier/db/schema";
import { and, desc, eq, inArray, max, ne, sql } from "drizzle-orm";
import { assetIdsOf, prepare, stringsOf, translationPath, type DocumentData, type ValidationIssue } from "./content";
import { db, type Executor, type Scope, type Tx } from "./db";
import { ConflictError, NotFoundError } from "./errors";

export type DocumentKind = (typeof document.$inferSelect)["kind"];
export type RevisionKind = (typeof documentRevision.$inferSelect)["kind"];

export type StudioDocument = {
  id: string;
  siteId: string;
  kind: DocumentKind;
  draft: DocumentData;
  draftVersion: number;
  published: DocumentData | null;
  publishedAt: Date | null;
  publishedRevisionId: string | null;
  /** True when the draft differs from what storefronts render. */
  hasUnpublishedChanges: boolean;
  updatedAt: Date;
  updatedById: string | null;
};

export type SaveResult = { version: number; updatedAt: Date; issues: ValidationIssue[] };

export type RevisionSummary = {
  id: string;
  version: number;
  kind: RevisionKind;
  label: string | null;
  createdAt: Date;
  createdById: string | null;
  createdByName: string | null;
  isPublished: boolean;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function view(row: typeof document.$inferSelect): StudioDocument {
  return {
    id: row.id,
    siteId: row.siteId,
    kind: row.kind,
    draft: row.draftData as DocumentData,
    draftVersion: row.draftVersion,
    published: (row.publishedData as DocumentData | null) ?? null,
    publishedAt: row.publishedAt,
    publishedRevisionId: row.publishedRevisionId,
    hasUnpublishedChanges: row.publishedData == null || !same(row.draftData, row.publishedData),
    updatedAt: row.updatedAt,
    updatedById: row.updatedById,
  };
}

async function load(ex: Executor, scope: Scope, id: string, lock = false) {
  const q = ex
    .select()
    .from(document)
    .where(and(eq(document.id, id), eq(document.siteId, scope.siteId)))
    .limit(1);
  // A document from another site is indistinguishable from a missing one.
  const [row] = lock ? await q.for("update") : await q;
  if (!row) throw new NotFoundError();
  return row;
}

export async function getDocument(scope: Scope, id: string): Promise<StudioDocument> {
  return view(await load(db, scope, id));
}

/** Creates an empty (or seeded) draft document. Used by page/template creation. */
export async function createDocument(
  scope: Scope,
  input: { kind: DocumentKind; data?: DocumentData },
  ex: Executor = db,
): Promise<StudioDocument> {
  const { data } = prepare(input.data ?? { root: { props: {} }, content: [] });
  const [row] = await ex
    .insert(document)
    .values({ siteId: scope.siteId, kind: input.kind, draftData: data, updatedById: scope.userId ?? null })
    .returning();
  return view(row!);
}

/**
 * Saves the editor state. `baseVersion` is the draftVersion the editor loaded
 * or last saved; if someone else saved in between, a ConflictError carries the
 * winning version so the UI can offer "reload" or "overwrite".
 */
export async function saveDraft(
  scope: Scope,
  input: { id: string; data: unknown; baseVersion: number },
): Promise<SaveResult> {
  const { data, issues } = prepare(input.data);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(document)
      .set({
        draftData: data,
        draftVersion: sql`${document.draftVersion} + 1`,
        updatedAt: new Date(),
        updatedById: scope.userId ?? null,
      })
      .where(
        and(
          eq(document.id, input.id),
          eq(document.siteId, scope.siteId),
          eq(document.draftVersion, input.baseVersion),
        ),
      )
      .returning({ version: document.draftVersion, updatedAt: document.updatedAt });

    if (!row) {
      const current = await load(tx, scope, input.id);
      throw new ConflictError({
        version: current.draftVersion,
        updatedAt: current.updatedAt,
        updatedById: current.updatedById,
      });
    }

    await syncAssetUsage(tx, scope, input.id, data);
    await markStaleTranslations(tx, scope, input.id, data);
    return { ...row, issues };
  });
}

/** Overwrites regardless of version — the "keep mine" branch of a conflict. */
export async function forceSaveDraft(scope: Scope, input: { id: string; data: unknown }) {
  const current = await load(db, scope, input.id);
  return saveDraft(scope, { ...input, baseVersion: current.draftVersion });
}

async function nextRevisionVersion(tx: Tx, documentId: string) {
  const [r] = await tx
    .select({ v: max(documentRevision.version) })
    .from(documentRevision)
    .where(eq(documentRevision.documentId, documentId));
  return (r?.v ?? 0) + 1;
}

/**
 * Publishes the current draft: strict validation, then an immutable revision.
 * Storefronts only ever read `publishedData`.
 */
export async function publish(
  scope: Scope,
  input: { id: string; label?: string; baseVersion?: number },
): Promise<{ revisionId: string; version: number; publishedAt: Date }> {
  return db.transaction(async (tx) => {
    const row = await load(tx, scope, input.id, true);
    if (input.baseVersion != null && row.draftVersion !== input.baseVersion) {
      throw new ConflictError({ version: row.draftVersion, updatedAt: row.updatedAt, updatedById: row.updatedById });
    }
    const { data } = prepare(row.draftData, { strict: true });
    const version = await nextRevisionVersion(tx, row.id);
    const publishedAt = new Date();
    const [rev] = await tx
      .insert(documentRevision)
      .values({
        documentId: row.id,
        version,
        kind: "publish",
        data,
        label: input.label?.trim() || null,
        createdById: scope.userId ?? null,
      })
      .returning({ id: documentRevision.id });
    await tx
      .update(document)
      .set({ draftData: data, publishedData: data, publishedRevisionId: rev!.id, publishedAt })
      .where(eq(document.id, row.id));
    if (row.kind === "page") {
      await tx.update(page).set({ state: "PUBLISHED", publishedAt, updatedAt: publishedAt }).where(eq(page.documentId, row.id));
    }
    return { revisionId: rev!.id, version, publishedAt };
  });
}

/** Named snapshot of the draft without publishing ("Save version"). */
export async function createCheckpoint(scope: Scope, input: { id: string; label?: string }) {
  return db.transaction(async (tx) => {
    const row = await load(tx, scope, input.id, true);
    const version = await nextRevisionVersion(tx, row.id);
    const [rev] = await tx
      .insert(documentRevision)
      .values({
        documentId: row.id,
        version,
        kind: "checkpoint",
        data: row.draftData,
        label: input.label?.trim() || null,
        createdById: scope.userId ?? null,
      })
      .returning({ id: documentRevision.id, createdAt: documentRevision.createdAt });
    return { revisionId: rev!.id, version, createdAt: rev!.createdAt };
  });
}

export async function listRevisions(scope: Scope, id: string, opts: { limit?: number } = {}): Promise<RevisionSummary[]> {
  const doc = await load(db, scope, id);
  const rows = await db
    .select({
      id: documentRevision.id,
      version: documentRevision.version,
      kind: documentRevision.kind,
      label: documentRevision.label,
      createdAt: documentRevision.createdAt,
      createdById: documentRevision.createdById,
      createdByName: user.name,
    })
    .from(documentRevision)
    .leftJoin(user, eq(user.id, documentRevision.createdById))
    .where(eq(documentRevision.documentId, doc.id))
    .orderBy(desc(documentRevision.version))
    .limit(opts.limit ?? 100);
  return rows.map((r) => ({ ...r, isPublished: r.id === doc.publishedRevisionId }));
}

export async function getRevision(scope: Scope, id: string, revisionId: string) {
  await load(db, scope, id);
  const [rev] = await db
    .select()
    .from(documentRevision)
    .where(and(eq(documentRevision.id, revisionId), eq(documentRevision.documentId, id)))
    .limit(1);
  if (!rev) throw new NotFoundError("Revision");
  return { ...rev, data: rev.data as DocumentData };
}

/**
 * Loads a revision into the draft. Nothing goes live until the merchant
 * publishes, so restoring is always safe; use `rollback` to go live at once.
 */
export async function restoreRevision(scope: Scope, input: { id: string; revisionId: string }): Promise<SaveResult> {
  const rev = await getRevision(scope, input.id, input.revisionId);
  return forceSaveDraft(scope, { id: input.id, data: rev.data });
}

/** Restore + publish in one step: the storefront returns to that revision. */
export async function rollback(scope: Scope, input: { id: string; revisionId: string }) {
  const rev = await getRevision(scope, input.id, input.revisionId);
  await restoreRevision(scope, input);
  return publish(scope, { id: input.id, label: `Rollback to v${rev.version}` });
}

/** Throws away unpublished edits. */
export async function discardDraft(scope: Scope, id: string): Promise<SaveResult> {
  const row = await load(db, scope, id);
  if (row.publishedData == null) throw new NotFoundError("Published version");
  return forceSaveDraft(scope, { id, data: row.publishedData });
}

// ------------------------------------------------------------ side effects ---

/** Rebuilds the "where is this image used" index for one document. */
async function syncAssetUsage(tx: Tx, scope: Scope, documentId: string, data: DocumentData) {
  await tx.delete(assetUsage).where(eq(assetUsage.documentId, documentId));
  const ids = assetIdsOf(data);
  if (!ids.length) return;
  // Only index assets that exist in this site's organization.
  const [s] = await tx.select({ org: site.organizationId }).from(site).where(eq(site.id, scope.siteId));
  const known = await tx
    .select({ id: asset.id })
    .from(asset)
    .where(and(inArray(asset.id, ids), eq(asset.organizationId, s!.org)));
  if (known.length) await tx.insert(assetUsage).values(known.map((a) => ({ assetId: a.id, documentId })));
}

/** Flags translations whose source text changed since they were written. */
async function markStaleTranslations(tx: Tx, scope: Scope, documentId: string, data: DocumentData) {
  const ownerRef = `document:${documentId}`;
  const rows = await tx
    .select({ id: translation.id, path: translation.path, sourceHash: translation.sourceHash })
    .from(translation)
    .where(and(eq(translation.siteId, scope.siteId), eq(translation.ownerRef, ownerRef), ne(translation.status, "stale")));
  if (!rows.length) return;
  const current = new Map(stringsOf(data).map((s) => [translationPath(s.nodeId, s.path), s.sourceHash]));
  // Leaves that vanished keep their row (the node may come back via undo/restore).
  const stale = rows.filter((r) => current.has(r.path) && current.get(r.path) !== r.sourceHash).map((r) => r.id);
  if (stale.length) {
    await tx.update(translation).set({ status: "stale", updatedAt: new Date() }).where(inArray(translation.id, stale));
  }
}
