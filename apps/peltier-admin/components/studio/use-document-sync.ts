"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveDraftAction, type StudioConflict } from "@/app/studio-actions";
import { stableStringify } from "@/lib/stable-json";

export type SyncStatus = "saved" | "dirty" | "saving" | "error" | "conflict";

type Options = {
  site: string;
  documentId: string;
  version: number;
  hasUnpublishedChanges: boolean;
  initialData: unknown;
  /** Quiet period after the last edit before autosaving. */
  delay?: number;
};

/**
 * Autosave with optimistic concurrency. Undo/redo stays in the editor (Puck
 * history, gone on refresh); every settled state is persisted as the draft,
 * tagged with the draftVersion it was based on. A 409 stops autosave and
 * surfaces a conflict for the user to resolve.
 */
export function useDocumentSync({ site, documentId, version, hasUnpublishedChanges, initialData, delay = 1200 }: Options) {
  const [status, setStatus] = useState<SyncStatus>("saved");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [unpublished, setUnpublished] = useState(hasUnpublishedChanges);
  const [conflict, setConflict] = useState<StudioConflict | null>(null);
  const [error, setError] = useState<string | null>(null);

  const versionRef = useRef(version);
  const savedJson = useRef(stableStringify(initialData));
  const pending = useRef<{ data: unknown; json: string } | null>(null);
  const inflight = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blocked = useRef(false);

  const run = useCallback(
    async (force = false): Promise<boolean> => {
      if (timer.current) clearTimeout(timer.current);
      if (inflight.current) {
        await inflight.current;
      }
      const next = pending.current;
      if (!next) return true;
      if (blocked.current && !force) return false;
      if (next.json === savedJson.current && !force) {
        pending.current = null;
        setStatus("saved");
        return true;
      }
      setStatus("saving");
      const job = (async () => {
        const res = await saveDraftAction(site, { documentId, data: next.data, baseVersion: versionRef.current, force });
        if (res.ok) {
          versionRef.current = res.version;
          savedJson.current = next.json;
          blocked.current = false;
          setConflict(null);
          setError(null);
          setSavedAt(new Date(res.savedAt));
          setUnpublished(res.hasUnpublishedChanges);
          if (pending.current === next) pending.current = null;
          setStatus(pending.current ? "dirty" : "saved");
          return true;
        }
        if ("conflict" in res) {
          blocked.current = true;
          setConflict(res.conflict);
          setStatus("conflict");
          return false;
        }
        setError(res.error);
        setStatus("error");
        return false;
      })();
      inflight.current = job;
      try {
        return await job;
      } finally {
        inflight.current = null;
      }
    },
    [site, documentId],
  );

  const onChange = useCallback(
    (data: unknown) => {
      const json = stableStringify(data);
      if (json === savedJson.current && !pending.current) return;
      pending.current = { data, json };
      if (blocked.current) return;
      setStatus(json === savedJson.current ? "saved" : "dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void run(), delay);
    },
    [run, delay],
  );

  /** Save now (⌘S, before publish or navigation). Resolves true when persisted. */
  const flush = useCallback(() => run(), [run]);
  /** "Keep mine" after a conflict: overwrite with the editor's state. */
  const overwrite = useCallback(() => run(true), [run]);

  /** After the server draft was replaced (discard, restore, "use theirs"). */
  const reset = useCallback((data: unknown, nextVersion: number, nextUnpublished: boolean) => {
    if (timer.current) clearTimeout(timer.current);
    pending.current = null;
    blocked.current = false;
    versionRef.current = nextVersion;
    savedJson.current = stableStringify(data);
    setConflict(null);
    setError(null);
    setUnpublished(nextUnpublished);
    setStatus("saved");
    setSavedAt(new Date());
  }, []);

  const markPublished = useCallback(() => setUnpublished(false), []);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pending.current || inflight.current || blocked.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return {
    status,
    savedAt,
    conflict,
    error,
    hasUnpublishedChanges: unpublished || status === "dirty" || status === "saving",
    version: () => versionRef.current,
    onChange,
    flush,
    overwrite,
    reset,
    markPublished,
  };
}

export type DocumentSync = ReturnType<typeof useDocumentSync>;
