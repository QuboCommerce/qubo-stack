"use server";

import { db } from "@qubo/db/client";
import { user } from "@qubo/db/schema";
import * as studio from "@qubo/studio";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireSite } from "@/lib/admin";
import { emitDocumentPublished } from "@/lib/events";

/**
 * Studio server actions. Rules live in @qubo/studio; these only resolve
 * the acting user + site and translate errors into serialisable results.
 */

export type StudioConflict = { version: number; updatedAt: string; updatedByName: string | null };

export type SaveOutcome =
  | { ok: true; version: number; savedAt: string; hasUnpublishedChanges: boolean; warnings: number }
  | { ok: false; conflict: StudioConflict }
  | { ok: false; error: string };

export type PublishOutcome =
  | { ok: true; version: number; publishedAt: string }
  | { ok: false; conflict: StudioConflict }
  | { ok: false; error: string };

export type RevisionItem = {
  id: string;
  version: number;
  kind: "publish" | "checkpoint" | "autosave";
  label: string | null;
  createdAt: string;
  createdByName: string | null;
  isPublished: boolean;
};

const canPublish = (role: string) => role === "OWNER" || role === "ADMIN";

async function context(slug: string, needsPublish = false) {
  const { user, site } = await requireSite(slug);
  if (needsPublish && !canPublish(site.memberRole)) throw new studio.StudioError("forbidden", "Only owners and admins can publish.");
  return { scope: { siteId: site.id, userId: user.id } satisfies studio.Scope, site };
}

async function conflictOf(e: studio.ConflictError): Promise<StudioConflict> {
  let updatedByName: string | null = null;
  if (e.current.updatedById) {
    const [u] = await db.select({ name: user.name }).from(user).where(eq(user.id, e.current.updatedById));
    updatedByName = u?.name ?? null;
  }
  return { version: e.current.version, updatedAt: e.current.updatedAt.toISOString(), updatedByName };
}

function message(e: unknown) {
  if (e instanceof studio.StudioError) return e.message;
  console.error("[studio-action]", e);
  return "Something went wrong. Your changes are still in the editor.";
}

export async function saveDraftAction(
  slug: string,
  input: { documentId: string; data: unknown; baseVersion: number; force?: boolean },
): Promise<SaveOutcome> {
  try {
    const { scope } = await context(slug);
    const res = input.force
      ? await studio.forceSaveDraft(scope, { id: input.documentId, data: input.data })
      : await studio.saveDraft(scope, { id: input.documentId, data: input.data, baseVersion: input.baseVersion });
    return {
      ok: true,
      version: res.version,
      savedAt: res.updatedAt.toISOString(),
      hasUnpublishedChanges: res.hasUnpublishedChanges,
      warnings: res.issues.length,
    };
  } catch (e) {
    if (e instanceof studio.ConflictError) return { ok: false, conflict: await conflictOf(e) };
    return { ok: false, error: message(e) };
  }
}

export async function publishAction(slug: string, input: { documentId: string; baseVersion: number; label?: string }): Promise<PublishOutcome> {
  try {
    const { scope, site } = await context(slug, true);
    const res = await studio.publish(scope, { id: input.documentId, baseVersion: input.baseVersion, label: input.label });
    await emitDocumentPublished(site.id, input.documentId, res.version);
    await studio.notifyRevalidate(site.slug, [studio.documentTag(input.documentId)]);
    revalidatePath(`/${site.slug}/online-store`);
    return { ok: true, version: res.version, publishedAt: res.publishedAt.toISOString() };
  } catch (e) {
    if (e instanceof studio.ConflictError) return { ok: false, conflict: await conflictOf(e) };
    return { ok: false, error: message(e) };
  }
}

/** Reloads the latest server draft (after discard/restore/conflict "use theirs"). */
export async function loadDraftAction(slug: string, documentId: string) {
  try {
    const { scope } = await context(slug);
    const doc = await studio.getDocument(scope, documentId);
    return { ok: true as const, data: doc.draft, version: doc.draftVersion, hasUnpublishedChanges: doc.hasUnpublishedChanges };
  } catch (e) {
    return { ok: false as const, error: message(e) };
  }
}

export async function discardDraftAction(slug: string, documentId: string) {
  try {
    const { scope } = await context(slug);
    await studio.discardDraft(scope, documentId);
    return loadDraftAction(slug, documentId);
  } catch (e) {
    return { ok: false as const, error: message(e) };
  }
}

export async function listRevisionsAction(slug: string, documentId: string): Promise<{ ok: true; revisions: RevisionItem[] } | { ok: false; error: string }> {
  try {
    const { scope } = await context(slug);
    const rows = await studio.listRevisions(scope, documentId, { limit: 50 });
    return {
      ok: true,
      revisions: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function checkpointAction(slug: string, input: { documentId: string; label?: string }) {
  try {
    const { scope } = await context(slug);
    const res = await studio.createCheckpoint(scope, { id: input.documentId, label: input.label });
    return { ok: true as const, version: res.version };
  } catch (e) {
    return { ok: false as const, error: message(e) };
  }
}

export async function restoreRevisionAction(slug: string, input: { documentId: string; revisionId: string }) {
  try {
    const { scope } = await context(slug);
    await studio.restoreRevision(scope, { id: input.documentId, revisionId: input.revisionId });
    return loadDraftAction(slug, input.documentId);
  } catch (e) {
    return { ok: false as const, error: message(e) };
  }
}

export async function rollbackAction(slug: string, input: { documentId: string; revisionId: string }) {
  try {
    const { scope, site } = await context(slug, true);
    await studio.rollback(scope, { id: input.documentId, revisionId: input.revisionId });
    await studio.notifyRevalidate(site.slug, [studio.documentTag(input.documentId)]);
    return loadDraftAction(slug, input.documentId);
  } catch (e) {
    return { ok: false as const, error: message(e) };
  }
}
