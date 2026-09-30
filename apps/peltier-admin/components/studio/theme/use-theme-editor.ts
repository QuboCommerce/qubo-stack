"use client";

import { ThemeSchema, type Theme } from "@peltier/stylekit";
import { useCallback, useMemo, useRef, useState } from "react";
import { saveThemeDraftAction } from "@/app/theme-actions";
import { useDocumentSync } from "../use-document-sync";

export type ThemeRecord = {
  id: string;
  version: number;
  hasUnpublishedChanges: boolean;
  publishedAt: string | null;
  data: Theme;
};

type History = { past: Theme[]; present: Theme; future: Theme[] };

/** Rapid edits with the same key (slider drags, typing) collapse into one undo step. */
const COALESCE_MS = 700;
const HISTORY_LIMIT = 100;

/**
 * Theme draft state for the Studio: its own undo/redo (separate from the page's
 * Puck history), autosave with the same conflict handling as documents, and a
 * "last valid" theme so a half-typed name never blanks the canvas.
 */
export function useThemeEditor(site: string, record: ThemeRecord | null) {
  const [history, setHistory] = useState<History | null>(record ? { past: [], present: record.data, future: [] } : null);
  const historyRef = useRef(history);
  historyRef.current = history;
  const last = useRef<{ key: string; at: number } | null>(null);
  const themeId = record?.id ?? "";

  const save = useCallback(
    ({ data, baseVersion, force }: { data: unknown; baseVersion: number; force: boolean }) =>
      saveThemeDraftAction(site, { themeId, data, baseVersion, force }),
    [site, themeId],
  );
  const sync = useDocumentSync({
    site,
    documentId: themeId,
    version: record?.version ?? 0,
    hasUnpublishedChanges: record?.hasUnpublishedChanges ?? false,
    initialData: record?.data ?? null,
    delay: 900,
    save,
  });

  const draft = history?.present ?? null;
  const parsed = useMemo(() => (draft ? ThemeSchema.safeParse(draft) : null), [draft]);
  const lastValid = useRef<Theme | null>(record?.data ?? null);
  if (parsed?.success) lastValid.current = parsed.data;
  const issues = useMemo(
    () => (parsed && !parsed.success ? parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) : []),
    [parsed],
  );

  const commit = useCallback(
    (next: History) => {
      setHistory(next);
      historyRef.current = next;
      if (ThemeSchema.safeParse(next.present).success) sync.onChange(next.present);
    },
    [sync],
  );

  /** Applies an edit. Pass a `key` to merge a burst of edits (drags, typing) into one undo step. */
  const update = useCallback(
    (fn: (t: Theme) => Theme, key?: string) => {
      const h = historyRef.current;
      if (!h) return;
      const next = fn(h.present);
      if (next === h.present) return;
      const now = Date.now();
      const merge = !!key && last.current?.key === key && now - last.current.at < COALESCE_MS;
      last.current = key ? { key, at: now } : null;
      commit({
        past: merge ? h.past : [...h.past, h.present].slice(-HISTORY_LIMIT),
        present: next,
        future: [],
      });
    },
    [commit],
  );

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (!h?.past.length) return;
    last.current = null;
    commit({ past: h.past.slice(0, -1), present: h.past[h.past.length - 1]!, future: [h.present, ...h.future] });
  }, [commit]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (!h?.future.length) return;
    last.current = null;
    commit({ past: [...h.past, h.present], present: h.future[0]!, future: h.future.slice(1) });
  }, [commit]);

  /** Server copy replaced the draft (discard, restore, conflict "use theirs"). */
  const replace = useCallback(
    (next: { data: unknown; version: number; hasUnpublishedChanges: boolean }) => {
      const t = ThemeSchema.safeParse(next.data);
      if (!t.success) return;
      sync.reset(t.data, next.version, next.hasUnpublishedChanges);
      last.current = null;
      const h: History = { past: [], present: t.data, future: [] };
      setHistory(h);
      historyRef.current = h;
    },
    [sync],
  );

  return {
    id: themeId,
    /** The editable draft (may be momentarily invalid while typing). */
    draft,
    /** Always renderable: the latest valid draft. */
    theme: lastValid.current,
    issues,
    canUndo: !!history?.past.length,
    canRedo: !!history?.future.length,
    update,
    undo,
    redo,
    replace,
    sync,
  };
}

export type ThemeEditor = ReturnType<typeof useThemeEditor>;
