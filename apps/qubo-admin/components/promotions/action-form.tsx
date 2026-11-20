"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@qubo/shared/utils";
import type { ActionState } from "@/lib/action-state";

/**
 * A compact form for one server action: keeps the typed values on an error
 * (unlike `<form action>`), sends the pressed button's name and value, and
 * shows the error or a short "Saved" next to the fields.
 */
export function ActionForm({
  action,
  children,
  className,
  done,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  done?: string;
}) {
  const t = useTranslations("promotions.actionForm");
  const [state, formAction, pending] = useActionState(action, null);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!state?.ok) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 2200);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <form
      className={cn("group", className)}
      data-pending={pending || undefined}
      onSubmit={(e) => {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const data = new FormData(e.currentTarget, submitter);
        startTransition(() => formAction(data));
      }}
    >
      {children}
      {state?.error ? (
        <p role="alert" className="basis-full text-xs text-destructive">
          {state.error}
        </p>
      ) : flash ? (
        <p className="basis-full text-xs text-muted-foreground">{done ?? t("defaultDone")}</p>
      ) : null}
    </form>
  );
}
