"use server";

import * as studio from "@qubo/studio";
import { revalidatePath } from "next/cache";
import { requireSite } from "@/lib/admin";
import type { SaveOutcome } from "./studio-actions";
import { emitThemePublished } from "@/lib/events";

/**
 * Theme server actions for the Studio theme editor. Theme drafts autosave
 * like documents; publishing copies the draft to the live theme and records
 * a revision, so every published look can be restored.
 */

const canPublish = (role: string) => role === "OWNER" || role === "ADMIN";

async function context(slug: string, needsPublish = false) {
  const { user, site } = await requireSite(slug);
  if (needsPublish && !canPublish(site.memberRole)) throw new studio.StudioError("forbidden", "Only owners and admins can publish.");
  return { scope: { siteId: site.id, userId: user.id } satisfies studio.Scope, site };
}

function message(e: unknown) {
  if (e instanceof studio.ValidationError) return e.issues[0] ? `Theme is invalid: ${e.issues[0].path} ${e.issues[0].message}` : e.message;
  if (e instanceof studio.StudioError) return e.message;
  console.error("[theme-action]", e);
  return "Something went wrong. Your theme changes are still in the editor.";
}

export async function saveThemeDraftAction(
  slug: string,
  input: { themeId: string; data: unknown; baseVersion: number; force?: boolean },
): Promise<SaveOutcome> {
  try {
    const { scope } = await context(slug);
    // "Keep mine" after a conflict: save on top of whatever is current.
    const baseVersion = input.force ? (await studio.getTheme(scope, input.themeId)).draftVersion : input.baseVersion;
    const res = await studio.saveThemeDraft(scope, { id: input.themeId, data: input.data, baseVersion });
    const current = await studio.getTheme(scope, input.themeId);
    return {
      ok: true,
      version: res.version,
      savedAt: res.updatedAt.toISOString(),
      hasUnpublishedChanges: current.hasUnpublishedChanges,
      warnings: res.report.findings.filter((f) => f.severity !== "info").length,
    };
  } catch (e) {
    if (e instanceof studio.ConflictError) {
      return { ok: false, conflict: { version: e.current.version, updatedAt: e.current.updatedAt.toISOString(), updatedByName: null } };
    }
    return { ok: false, error: message(e) };
  }
}

export async function loadThemeAction(slug: string, themeId: string) {
  try {
    const { scope } = await context(slug);
    const t = await studio.getTheme(scope, themeId);
    return { ok: true as const, data: t.draft as unknown, version: t.draftVersion, hasUnpublishedChanges: t.hasUnpublishedChanges };
  } catch (e) {
    return { ok: false as const, error: message(e) };
  }
}

export async function publishThemeAction(slug: string, input: { themeId: string; label?: string }) {
  try {
    const { scope, site } = await context(slug, true);
    const res = await studio.publishTheme(scope, { id: input.themeId, label: input.label });
    await emitThemePublished(site.id, input.themeId);
    const t = await studio.getTheme(scope, input.themeId);
    // Every page renders with the theme, so the whole site is stale.
    if (t.isActive) await studio.notifyRevalidate(site.slug, [studio.themeTag(site.id)]);
    revalidatePath(`/${site.slug}/online-store`);
    return { ok: true as const, version: res.version, publishedAt: res.publishedAt.toISOString() };
  } catch (e) {
    return { ok: false as const, error: message(e) };
  }
}

/** Discards unpublished theme edits: the draft goes back to the live copy. */
export async function discardThemeDraftAction(slug: string, themeId: string) {
  try {
    const { scope } = await context(slug);
    const t = await studio.getTheme(scope, themeId);
    if (!t.published) return { ok: false as const, error: "This theme has never been published." };
    await studio.saveThemeDraft(scope, { id: themeId, data: t.published, baseVersion: t.draftVersion });
    return loadThemeAction(slug, themeId);
  } catch (e) {
    return { ok: false as const, error: message(e) };
  }
}

export type ThemeRevisionItem = { id: string; version: number; label: string | null; createdAt: string; createdByName: string | null };

export async function listThemeRevisionsAction(
  slug: string,
  themeId: string,
): Promise<{ ok: true; revisions: ThemeRevisionItem[] } | { ok: false; error: string }> {
  try {
    const { scope } = await context(slug);
    const rows = await studio.listThemeRevisions(scope, themeId);
    return { ok: true, revisions: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function restoreThemeRevisionAction(slug: string, input: { themeId: string; revisionId: string }) {
  try {
    const { scope } = await context(slug);
    await studio.restoreThemeRevision(scope, { id: input.themeId, revisionId: input.revisionId });
    return loadThemeAction(slug, input.themeId);
  } catch (e) {
    return { ok: false as const, error: message(e) };
  }
}
