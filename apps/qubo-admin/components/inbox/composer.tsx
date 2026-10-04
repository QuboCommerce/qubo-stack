"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Lock, Send } from "lucide-react";
import { toast } from "sonner";
import { replyAction } from "@/app/inbox-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@qubo/shared/utils";

export function Composer({ site, conversationId, contactEmail, emailReady }: { site: string; conversationId: string; contactEmail: string | null; emailReady: boolean }) {
  const [state, action, pending] = useActionState(replyAction, null);
  const [internal, setInternal] = useState(!contactEmail);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state?.at) return;
    if (state.error) toast.warning(state.error);
    if (state.ok) form.current?.reset();
  }, [state?.at]); // eslint-disable-line react-hooks/exhaustive-deps

  const canEmail = Boolean(contactEmail);
  const hint = internal
    ? "Internal note: only your team sees this."
    : emailReady
      ? `Sent by e-mail to ${contactEmail}.`
      : `Saved to the thread. E-mail isn't configured on this instance, so ${contactEmail} won't receive it.`;

  return (
    <form ref={form} action={action} className={cn("border-t p-3", internal && "bg-amber-50/60 dark:bg-amber-950/20")}>
      <input type="hidden" name="site" value={site} />
      <input type="hidden" name="id" value={conversationId} />
      {internal && <input type="hidden" name="internal" value="on" />}
      <textarea
        name="body"
        required
        rows={4}
        placeholder={internal ? "Add a note for your team…" : "Write a reply…"}
        className="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) form.current?.requestSubmit();
        }}
      />
      {state?.error && !state.ok && <p className="mt-1 text-sm text-destructive">{state.error}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border p-0.5 text-[13px]">
          <button type="button" disabled={!canEmail} onClick={() => setInternal(false)} className={cn("rounded-md px-2.5 py-1 disabled:opacity-40", !internal && "bg-accent font-medium")}>
            Reply
          </button>
          <button type="button" onClick={() => setInternal(true)} className={cn("flex items-center gap-1 rounded-md px-2.5 py-1", internal && "bg-accent font-medium")}>
            <Lock className="size-3" /> Note
          </button>
        </div>
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{hint}</p>
        <Button type="submit" size="sm" disabled={pending}>
          <Send /> {pending ? "Sending…" : internal ? "Add note" : "Send"}
        </Button>
      </div>
    </form>
  );
}
