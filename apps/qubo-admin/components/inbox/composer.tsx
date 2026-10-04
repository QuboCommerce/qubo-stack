"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Lock, Paperclip, Send } from "lucide-react";
import { LIMITS } from "@qubo/inbox";
import { toast } from "sonner";
import { replyAction } from "@/app/inbox-actions";
import { useReplyFiles } from "@/components/inbox/files";
import { Button } from "@/components/ui/button";
import { cn } from "@qubo/shared/utils";

export function Composer({
  site,
  conversationId,
  contactEmail,
  emailReady,
  chat,
}: {
  site: string;
  conversationId: string;
  contactEmail: string | null;
  emailReady: boolean;
  /** Chat threads: replies reach the visitor live; `online` = they have the chat open right now. */
  chat?: { online: boolean };
}) {
  const [state, action, pending] = useActionState(replyAction, null);
  const canReply = Boolean(contactEmail) || Boolean(chat);
  const [internal, setInternal] = useState(!canReply);
  const form = useRef<HTMLFormElement>(null);
  const files = useReplyFiles(site, conversationId, LIMITS.replyFiles);

  useEffect(() => {
    if (!state?.at) return;
    if (state.error) toast.warning(state.error);
    if (state.ok) {
      form.current?.reset();
      files.reset();
    }
  }, [state?.at]); // eslint-disable-line react-hooks/exhaustive-deps

  const hint = internal
    ? "Internal note: only your team sees this."
    : chat
      ? chat.online
        ? "Visitor is in the chat now: they'll see this instantly."
        : contactEmail
          ? emailReady
            ? `Visitor left the chat: shown when they return and e-mailed to ${contactEmail}.`
            : `Visitor left the chat: shown when they return (e-mail isn't configured on this instance).`
          : "Visitor left the chat: shown when they return. They left no e-mail address."
      : emailReady
      ? `Sent by e-mail to ${contactEmail}.`
      : `Saved to the thread. E-mail isn't configured on this instance, so ${contactEmail} won't receive it.`;

  return (
    <form
      ref={form}
      action={action}
      className={cn("border-t p-3", internal && "bg-amber-50/60 dark:bg-amber-950/20")}
      onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        void files.upload(Array.from(e.dataTransfer.files));
      }}
    >
      {files.picker}
      <input type="hidden" name="site" value={site} />
      <input type="hidden" name="id" value={conversationId} />
      {internal && <input type="hidden" name="internal" value="on" />}
      <textarea
        name="body"
        required={!files.drafts.length}
        rows={4}
        placeholder={internal ? "Add a note for your team…" : "Write a reply…"}
        className="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) form.current?.requestSubmit();
        }}
        onPaste={(e) => {
          const pasted = Array.from(e.clipboardData.files);
          if (!pasted.length) return;
          e.preventDefault();
          void files.upload(pasted);
        }}
      />
      {files.list}
      {files.error && <p className="mt-1 text-sm text-destructive">{files.error}</p>}
      {state?.error && !state.ok && <p className="mt-1 text-sm text-destructive">{state.error}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border p-0.5 text-[13px]">
          <button type="button" disabled={!canReply} onClick={() => setInternal(false)} className={cn("rounded-md px-2.5 py-1 disabled:opacity-40", !internal && "bg-accent font-medium")}>
            Reply
          </button>
          <button type="button" onClick={() => setInternal(true)} className={cn("flex items-center gap-1 rounded-md px-2.5 py-1", internal && "bg-accent font-medium")}>
            <Lock className="size-3" /> Note
          </button>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={files.open} disabled={files.drafts.length >= LIMITS.replyFiles} aria-label="Attach files" title="Attach files (or paste / drop them)">
          <Paperclip />
        </Button>
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{hint}</p>
        <Button type="submit" size="sm" disabled={pending || files.uploading > 0}>
          <Send /> {pending ? "Sending…" : internal ? "Add note" : "Send"}
        </Button>
      </div>
    </form>
  );
}
