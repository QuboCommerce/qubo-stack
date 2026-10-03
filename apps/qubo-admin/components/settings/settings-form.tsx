"use client";

import { startTransition, useActionState, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@qubo/shared/utils";

/**
 * Shopify-style contextual save bar: appears over the top bar only once the
 * form is dirty. Discard restores defaults; ⌘S / Ctrl+S saves.
 */
export function SettingsForm({
  action,
  readOnly,
  children,
  className,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  readOnly?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const ref = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(action, null);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  useEffect(() => {
    if (state?.error) setError(state.error);
    if (!state?.ok) return;
    setError(null);
    setDirty(false);
    setToast(true);
    const t = setTimeout(() => setToast(false), 2600);
    return () => clearTimeout(t);
  }, [state]);

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
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      {error && (
        <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}
      <fieldset disabled={readOnly || pending} className={cn("min-w-0", className)}>
        {children}
      </fieldset>

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
            <CheckCircle2 className="size-4 text-success" /> Settings saved
          </div>,
          document.body,
        )}
    </form>
  );
}
