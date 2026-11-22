"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { Bold, CircleCheck, Info, Italic, Link2, List, ListOrdered, Lock, Paperclip, Quote, Send, Sparkles } from "lucide-react";
import { LIMITS } from "@qubo/inbox";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { draftReplyAction } from "@/app/ai-actions";
import { escalateAction, replyAction, updateConversationAction } from "@/app/inbox-actions";
import { useReplyFiles } from "@/components/inbox/files";
import { Recipients } from "@/components/inbox/recipients";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@qubo/shared/utils";

import { COMPOSE_EVENT, type ComposeDetail } from "@/components/inbox/use-inbox";

type Command = { key: "note" | "reply" | "ticket" | "pending" | "close" | "snooze" | "assign"; run: () => void };

export function Composer({
  site,
  conversationId,
  contactEmail,
  participants,
  emailReady,
  chat,
  ticket,
  aiDrafts,
}: {
  site: string;
  conversationId: string;
  contactEmail: string | null;
  /** Thread Cc/Bcc, prefilled on every e-mail reply. */
  participants: { cc: string[]; bcc: string[] };
  emailReady: boolean;
  /** Chat threads: replies reach the visitor live; `online` = they have the chat open right now. */
  chat?: { online: boolean };
  /** Already a ticket: `/ticket` is hidden. */
  ticket: boolean;
  /** AI is set up with drafts on for this organisation. */
  aiDrafts?: boolean;
}) {
  const t = useTranslations("inbox.composer");
  const [state, action, pending] = useActionState(replyAction, null);
  const canReply = Boolean(contactEmail) || Boolean(chat);
  const [internal, setInternal] = useState(!canReply);
  const form = useRef<HTMLFormElement>(null);
  const docInput = useRef<HTMLInputElement>(null);
  const bodyInput = useRef<HTMLInputElement>(null);
  const files = useReplyFiles(site, conversationId, LIMITS.replyFiles);
  const [drafting, startDraft] = useTransition();
  const [running, startCommand] = useTransition();
  const [slash, setSlash] = useState<{ query: string; index: number } | null>(null);
  const [focused, setFocused] = useState(false);
  const [empty, setEmpty] = useState(true);
  const resolveButton = useRef<HTMLButtonElement>(null);
  const draftKey = `qb:inbox-draft:${conversationId}`;

  // Editor callbacks are created once; they read the live values through this ref.
  const live = useRef({ internal, chat: Boolean(chat), slash, commands: [] as Command[], run: (_c: Command) => {}, upload: (_f: File[]) => {}, save: () => {} });

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false, code: false, horizontalRule: false, link: { openOnClick: false, autolink: true, defaultProtocol: "https" } }),
      Placeholder.configure({ placeholder: () => (live.current.internal ? t("notePlaceholder") : live.current.chat ? t("chatPlaceholder") : t("replyPlaceholder")) }),
    ],
    editorProps: {
      attributes: { class: "qb-rich max-h-[40vh] overflow-y-auto px-3 py-2 text-sm outline-none", "aria-label": t("editorLabel") },
      handleKeyDown: (_view, e) => {
        const s = live.current.slash;
        const matches = s ? filterCommands(live.current.commands, s.query) : [];
        if (s && matches.length) {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            const step = e.key === "ArrowDown" ? 1 : -1;
            setSlash({ ...s, index: (s.index + step + matches.length) % matches.length });
            return true;
          }
          if (e.key === "Enter" || e.key === "Tab") {
            live.current.run(matches[s.index] ?? matches[0]!);
            return true;
          }
          if (e.key === "Escape") return (setSlash(null), true);
        }
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) return (form.current?.requestSubmit(e.shiftKey ? resolveButton.current : undefined), true);
        // Chat feels like chat: Enter sends, Shift+Enter breaks the line.
        if (e.key === "Enter" && !e.shiftKey && live.current.chat && !live.current.internal) return (form.current?.requestSubmit(), true);
        return false;
      },
      handlePaste: (_view, e) => {
        const pasted = Array.from(e.clipboardData?.files ?? []);
        if (!pasted.length) return false;
        live.current.upload(pasted);
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      setEmpty(editor.isEmpty);
      live.current.save();
      const m = editor.getText().match(/^\/([a-z]*)$/i);
      setSlash((s) => (m ? { query: m[1]!.toLowerCase(), index: s?.query === m[1]!.toLowerCase() ? s.index : 0 } : null));
    },
  });

  const exec = (fields: Record<string, string>) => {
    const fd = new FormData();
    fd.set("site", site);
    fd.set("id", conversationId);
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return fd;
  };

  const commands: Command[] = [
    { key: "reply", run: () => canReply && setInternal(false) },
    { key: "note", run: () => setInternal(true) },
    ...(!ticket
      ? [{ key: "ticket" as const, run: () => startCommand(async () => void (await escalateAction(exec({})))) }]
      : []),
    { key: "pending", run: () => startCommand(() => updateConversationAction(exec({ status: "pending" }))) },
    { key: "close", run: () => startCommand(() => updateConversationAction(exec({ status: "resolved" }))) },
    { key: "snooze", run: () => startCommand(() => updateConversationAction(exec({ snooze: "1d" }))) },
    { key: "assign", run: () => startCommand(() => updateConversationAction(exec({ assigneeId: "me" }))) },
  ];
  function runCommand(c: Command) {
    editor?.commands.clearContent(true);
    setSlash(null);
    c.run();
    toast.success(t(`commands.${c.key}.done`));
  }
  // Drafts survive switching threads and reloads (this browser only).
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const save = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        if (!editor || editor.isEmpty) localStorage.removeItem(draftKey);
        else localStorage.setItem(draftKey, JSON.stringify({ doc: editor.getJSON(), internal: live.current.internal, at: Date.now() }));
      } catch {}
    }, 400);
  };
  live.current = { internal, chat: Boolean(chat), slash, commands, run: runCommand, upload: (f) => void files.upload(f), save };

  useEffect(() => {
    if (!editor) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw) as { doc: object; internal: boolean };
      editor.commands.setContent(d.doc);
      setEmpty(editor.isEmpty);
      if (d.internal || canReply) setInternal(d.internal || !canReply);
    } catch {}
  }, [editor]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => save(), [internal]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onCompose = (e: Event) => {
      const { mode, quote } = (e as CustomEvent<ComposeDetail>).detail;
      setInternal(mode === "note" || !canReply);
      if (quote && editor) {
        const lines = quote.trim().split("\n").slice(0, 40);
        editor
          .chain()
          .focus("end")
          .insertContent([{ type: "blockquote", content: lines.map((l) => ({ type: "paragraph", content: l ? [{ type: "text", text: l }] : [] })) }, { type: "paragraph" }])
          .run();
      } else editor?.commands.focus("end");
      form.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    };
    window.addEventListener(COMPOSE_EVENT, onCompose);
    return () => window.removeEventListener(COMPOSE_EVENT, onCompose);
  }, [editor, canReply]);

  // Placeholder depends on the mode; nudge the editor to redraw it.
  useEffect(() => {
    editor?.view.dispatch(editor.state.tr);
  }, [editor, internal]);

  const draft = () => {
    if (editor && !editor.isEmpty && !confirm(t("confirmReplace"))) return;
    startDraft(async () => {
      const r = await draftReplyAction(null, exec({}));
      if (r.error) return void toast.error(r.error);
      if (!editor || !r.text) return;
      setInternal(false);
      editor.commands.setContent({ type: "doc", content: r.text.split("\n").map((line) => ({ type: "paragraph", content: line ? [{ type: "text", text: line }] : [] })) });
      editor.commands.focus("start");
    });
  };

  useEffect(() => {
    if (!state?.at) return;
    if (state.error) toast.warning(state.error);
    if (state.ok) {
      editor?.commands.clearContent(true);
      files.reset();
      try {
        localStorage.removeItem(draftKey);
      } catch {}
    }
  }, [state?.at]); // eslint-disable-line react-hooks/exhaustive-deps

  const email = contactEmail ?? "";
  const hint = internal
    ? t("hintInternal")
    : chat
      ? chat.online
        ? t("hintChatOnline")
        : contactEmail
          ? emailReady
            ? t("hintChatAwayEmail", { email })
            : t("hintChatAwayNoMail")
          : t("hintChatAwayNoAddress")
      : emailReady
        ? t("hintEmail", { email })
        : t("hintEmailOff", { email });

  const matches = slash ? filterCommands(commands, slash.query) : [];
  const showRecipients = !internal && !chat && Boolean(contactEmail);
  // Compact until used: one line, no toolbar, so the thread gets the room.
  const open = focused || !empty || files.drafts.length > 0 || matches.length > 0;

  return (
    <form
      ref={form}
      action={action}
      id="composer"
      className={cn("relative border-t bg-card", internal && "bg-amber-50/60 dark:bg-amber-950/20")}
      onSubmit={(e) => {
        if (!editor || (editor.isEmpty && !files.drafts.length)) {
          e.preventDefault();
          return;
        }
        docInput.current!.value = editor.isEmpty ? "" : JSON.stringify(editor.getJSON());
        bodyInput.current!.value = editor.getText({ blockSeparator: "\n" });
      }}
      onFocus={() => setFocused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setFocused(false)}
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
      <input ref={docInput} type="hidden" name="doc" />
      <input ref={bodyInput} type="hidden" name="body" />
      {internal && <input type="hidden" name="internal" value="on" />}
      {showRecipients && open && <Recipients key={conversationId} to={email} initial={participants} />}

      {matches.length > 0 && (
        <ul role="listbox" aria-label={t("commands.label")} className="absolute bottom-full left-3 z-10 mb-1 w-72 overflow-hidden rounded-lg border bg-popover p-1 text-sm shadow-lg">
          {matches.map((c, i) => (
            <li key={c.key} role="option" aria-selected={i === slash!.index}>
              <button
                type="button"
                onMouseDown={(e) => (e.preventDefault(), runCommand(c))}
                className={cn("flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left", i === slash!.index && "bg-accent")}
              >
                <span className="font-mono text-xs">/{c.key}</span>
                <span className="truncate text-muted-foreground">{t(`commands.${c.key}.label`)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={cn("mx-3 mt-2 rounded-lg border bg-background focus-within:ring-2 focus-within:ring-ring/40", running && "opacity-60")} aria-busy={drafting || running}>
        {!chat && editor && open && <Toolbar editor={editor} />}
        <EditorContent editor={editor} className={cn(open ? "[&_.ProseMirror]:min-h-[4.5rem]" : "[&_.ProseMirror]:min-h-[2.25rem]")} />
      </div>
      <div className="px-3">
        {files.list}
        {files.error && <p className="mt-1 text-sm text-destructive">{files.error}</p>}
        {state?.error && !state.ok && <p className="mt-1 text-sm text-destructive">{state.error}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2 p-3 pt-2">
        <div className="flex rounded-lg border p-0.5 text-[13px]">
          <button type="button" disabled={!canReply} onClick={() => setInternal(false)} className={cn("rounded-md px-2.5 py-1 disabled:opacity-40", !internal && "bg-accent font-medium")}>
            {t("reply")}
          </button>
          <button type="button" onClick={() => setInternal(true)} className={cn("flex items-center gap-1 rounded-md px-2.5 py-1", internal && "bg-accent font-medium")}>
            <Lock className="size-3" /> {t("note")}
          </button>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={files.open} disabled={files.drafts.length >= LIMITS.replyFiles} aria-label={t("attach")} title={t("attachHint")}>
          <Paperclip />
        </Button>
        {aiDrafts && canReply && (
          <Button type="button" variant="ghost" size="sm" onClick={draft} disabled={drafting} title={t("draftHint")}>
            <Sparkles className={cn(drafting && "animate-pulse")} /> {drafting ? t("drafting") : t("draft")}
          </Button>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={hint}>
              <Info className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-72">
            <p>{hint}</p>
            <p className="mt-1 opacity-70">{t("slashHint")} · {t("keysHint")}</p>
          </TooltipContent>
        </Tooltip>
        <p className="hidden min-w-0 flex-1 truncate text-xs text-muted-foreground sm:block">{hint}</p>
        <span className="flex-1 sm:hidden" />
        <div className="flex">
          <Button type="submit" size="sm" className="rounded-r-none" disabled={pending || files.uploading > 0}>
            <Send /> {pending ? t("sending") : internal ? t("addNote") : t("send")}
          </Button>
          <Button
            ref={resolveButton}
            type="submit"
            name="after"
            value="resolved"
            size="sm"
            className="rounded-l-none border-l border-background/20 px-2"
            disabled={pending || files.uploading > 0}
            aria-label={internal ? t("addNoteResolve") : t("sendResolve")}
            title={`${internal ? t("addNoteResolve") : t("sendResolve")} (Ctrl+Shift+Enter)`}
          >
            <CircleCheck />
          </Button>
        </div>
      </div>
    </form>
  );
}

const filterCommands = (list: Command[], q: string) => list.filter((c) => c.key.startsWith(q));

function Toolbar({ editor }: { editor: Editor }) {
  const t = useTranslations("inbox.composer.format");
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      link: e.isActive("link"),
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      blockquote: e.isActive("blockquote"),
    }),
  });
  const link = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt(t("linkPrompt"), prev ?? "https://");
    if (href === null) return;
    if (!href.trim() || href.trim() === "https://") return void editor.chain().focus().extendMarkRange("link").unsetLink().run();
    editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
  };
  const tools = [
    { key: "bold", icon: Bold, on: active.bold, run: () => editor.chain().focus().toggleBold().run() },
    { key: "italic", icon: Italic, on: active.italic, run: () => editor.chain().focus().toggleItalic().run() },
    { key: "link", icon: Link2, on: active.link, run: link },
    { key: "bulletList", icon: List, on: active.bulletList, run: () => editor.chain().focus().toggleBulletList().run() },
    { key: "orderedList", icon: ListOrdered, on: active.orderedList, run: () => editor.chain().focus().toggleOrderedList().run() },
    { key: "quote", icon: Quote, on: active.blockquote, run: () => editor.chain().focus().toggleBlockquote().run() },
  ] as const;
  return (
    <div role="toolbar" aria-label={t("label")} className="flex gap-0.5 border-b px-1.5 py-1">
      {tools.map(({ key, icon: Icon, on, run }) => (
        <button
          key={key}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={run}
          aria-pressed={on}
          aria-label={t(key)}
          title={t(key)}
          className={cn("grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground", on && "bg-accent text-foreground")}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}
