"use client";

import { Fragment, startTransition, useActionState, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, GitMerge, Loader2 } from "lucide-react";
import { useEvent } from "@qubo/realtime/client";
import type { ActionState } from "@/lib/action-state";
import { applyValues, type Conflict, type FormValues } from "@/lib/merge";
import { useViewer } from "@/components/live-events";
import { MergeSheet } from "@/components/settings/merge-sheet";
import { cn } from "@qubo/shared/utils";

/**
 * Shopify-style contextual save bar: appears over the top bar only once the
 * form is dirty. Discard restores defaults; ⌘S / Ctrl+S saves.
 *
 * With `base` (the values the server rendered) saves are three-way merged
 * against the current row; with `watch` the form follows `entity.updated`
 * for that row: a clean form reloads in place, a dirty one shows a banner.
 */
export function SettingsForm({
  action,
  readOnly,
  children,
  className,
  base,
  watch,
  noun = "page",
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  readOnly?: boolean;
  children: React.ReactNode;
  className?: string;
  base?: FormValues;
  watch?: { table: string; id: string };
  noun?: string;
}) {
  const id = useId();
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const viewer = useViewer();
  const [state, formAction, pending] = useActionState(action, null);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [remote, setRemote] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  // Inputs are uncontrolled: remount them when fresh server values arrive,
  // but never while editing. The base sent with a save stays the one the
  // edits started from, so their changes can't be silently overwritten.
  const baseJson = JSON.stringify(base ?? null);
  const [shown, setShown] = useState(baseJson);
  useEffect(() => {
    if (!dirty) setShown(baseJson);
  }, [baseJson, dirty]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600);
  };

  useEffect(() => {
    if (state?.error) setError(state.error);
    if (state?.conflict) setConflict(state.conflict);
    if (!state?.ok) return;
    setError(null);
    setRemote(null);
    setDirty(false);
    flash("Saved");
  }, [state]);

  useEvent("entity.updated", (e) => {
    if (!watch || e.payload.table !== watch.table || e.payload.id !== watch.id) return;
    const mine = e.payload.by.id === viewer?.userId;
    if (!dirtyRef.current) {
      router.refresh();
      if (!mine) flash(`Updated by ${e.payload.by.name} just now`);
    } else if (!mine) setRemote(e.payload.by.name);
  });

  const submit = (data: FormData) => startTransition(() => formAction(data));
  const review = () => {
    if (!ref.current) return;
    const data = new FormData(ref.current);
    data.set("_preview", "1");
    submit(data);
  };

  // Native listeners: form.reset() bypasses React's value tracker, so React's
  // onChange would miss re-typing a value that was just discarded.
  useEffect(() => {
    const form = ref.current;
    if (!form || readOnly) return;
    const mark = () => {
      dirtyRef.current = true;
      setDirty(true);
    };
    form.addEventListener("input", mark);
    form.addEventListener("change", mark);
    return () => {
      form.removeEventListener("input", mark);
      form.removeEventListener("change", mark);
    };
  }, [readOnly]);

  useEffect(() => {
    const save = (e: KeyboardEvent) => {
      if (dirtyRef.current && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        ref.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", save);
    return () => window.removeEventListener("keydown", save);
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return (
    <form
      id={id}
      ref={ref}
      // Dispatch manually: <form action> would auto-reset fields and lose edits on a validation error.
      onSubmit={(e) => {
        e.preventDefault();
        if (readOnly) return;
        submit(new FormData(e.currentTarget));
      }}
    >
      {base && <input type="hidden" name="_base" value={shown} />}
      {remote && !conflict && (
        <div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm">
          <GitMerge className="size-4 shrink-0 text-warning" />
          <span className="flex-1">{remote} saved changes to this {noun}. Your edits are kept.</span>
          <button type="button" onClick={review} disabled={pending} className="h-7 rounded-md px-2.5 text-[13px] font-medium hover:bg-warning/15">
            Review
          </button>
        </div>
      )}
      {error && (
        <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}
      <fieldset disabled={readOnly || pending} className={cn("min-w-0", className)}>
        <Fragment key={shown}>{children}</Fragment>
      </fieldset>

      {conflict && (
        <MergeSheet
          conflict={conflict}
          noun={noun}
          onCancel={() => setConflict(null)}
          onResolve={(choices) => {
            const form = ref.current;
            if (!form) return;
            const data = applyValues(new FormData(form), conflict.merged);
            for (const f of conflict.fields) applyValues(data, { [f.name]: choices[f.name] === "theirs" ? f.theirs : f.mine });
            data.set("_base", JSON.stringify(conflict.theirs));
            data.delete("_preview");
            setConflict(null);
            submit(data);
          }}
        />
      )}

      {dirty &&
        createPortal(
          <div className="fixed inset-x-0 top-0 z-50 flex h-14 items-center gap-3 bg-topbar px-3 text-topbar-foreground shadow-lg animate-in fade-in slide-in-from-top-2 sm:px-5">
            <AlertCircle className="size-4 shrink-0 text-warning" />
            <span className="flex-1 truncate text-sm font-medium">Unsaved changes</span>
            <button
              type="button"
              onClick={() => {
                ref.current?.reset();
                setDirty(false);
                setError(null);
              }}
              disabled={pending}
              className="h-8 rounded-lg px-3 text-[13px] font-medium text-topbar-foreground/80 hover:bg-topbar-muted hover:text-topbar-foreground"
            >
              Discard
            </button>
            <button
              type="submit"
              form={id}
              disabled={pending}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-white px-3.5 text-[13px] font-semibold text-neutral-900 shadow-sm hover:bg-white/90 disabled:opacity-70"
            >
              {pending && <Loader2 className="size-3.5 animate-spin" />}
              Save
            </button>
          </div>,
          document.body,
        )}

      {toast &&
        createPortal(
          <div
            role="status"
            className={cn(
              "fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-foreground px-4 py-2 text-[13px] font-medium text-background shadow-xl",
              "animate-in fade-in slide-in-from-bottom-2",
            )}
          >
            <CheckCircle2 className="size-4 text-success" /> {toast}
          </div>,
          document.body,
        )}
    </form>
  );
}
