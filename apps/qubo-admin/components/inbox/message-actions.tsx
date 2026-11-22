"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@qubo/shared/utils";
import { Check, Copy, Link2, MailMinus, MoreHorizontal, Quote, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteNoteAction } from "@/app/inbox-actions";
import { COMPOSE_EVENT, conversationLink, INFO_EVENT, useCopy, useInboxActions, type ComposeDetail } from "@/components/inbox/use-inbox";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

export type MessageRef = {
  id: string;
  /** Plain text, for copying and quoting. */
  text: string;
  /** Staff note by the viewer: can be deleted. */
  ownNote: boolean;
  /** Notes and system lines can't be quoted to the customer. */
  quotable: boolean;
};

type Kit = { Item: typeof DropdownMenuItem | typeof ContextMenuItem; Separator: typeof DropdownMenuSeparator | typeof ContextMenuSeparator };

function MessageItems({ kit: K, m, site, conversationId }: { kit: Kit; m: MessageRef; site: string; conversationId: string }) {
  const t = useTranslations("inbox.message");
  const copy = useCopy();
  const { unreadFrom } = useInboxActions(site);
  const quote = () => window.dispatchEvent(new CustomEvent<ComposeDetail>(COMPOSE_EVENT, { detail: { mode: "reply", quote: m.text } }));
  const remove = async () => {
    if (!confirm(t("confirmDelete"))) return;
    const { ok } = await deleteNoteAction(site, m.id);
    if (ok) toast.success(t("deleted"));
  };
  return (
    <>
      {m.text && (
        <K.Item onSelect={() => copy(m.text, t("text"))}>
          <Copy /> {t("copyText")}
        </K.Item>
      )}
      {m.quotable && m.text && (
        <K.Item onSelect={quote}>
          <Quote /> {t("quote")}
        </K.Item>
      )}
      <K.Item onSelect={() => copy(conversationLink(site, conversationId, m.id), t("link"))}>
        <Link2 /> {t("copyLink")}
      </K.Item>
      <K.Item onSelect={() => unreadFrom(conversationId, m.id)}>
        <MailMinus /> {t("unreadFromHere")}
      </K.Item>
      {m.ownNote && (
        <>
          <K.Separator />
          <K.Item variant="destructive" onSelect={remove}>
            <Trash2 /> {t("deleteNote")}
          </K.Item>
        </>
      )}
    </>
  );
}

/**
 * One message with its actions: right click (long press on touch), a hover
 * toolbar on desktop and a always-visible "..." on touch screens.
 */
export function MessageShell({ m, site, conversationId, children, className }: { m: MessageRef; site: string; conversationId: string; children: ReactNode; className?: string }) {
  const t = useTranslations("inbox.message");
  const copy = useCopy();
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className={cn("group/msg relative [-webkit-touch-callout:none]", className)}>
          {children}
          <div className="absolute -top-3 right-2 z-10 flex items-center rounded-md border bg-popover p-0.5 opacity-0 shadow-xs transition-opacity focus-within:opacity-100 group-hover/msg:opacity-100 has-[[data-state=open]]:opacity-100 [@media(hover:none)]:hidden">
            {m.text && (
              <button type="button" onClick={() => copy(m.text, t("text"))} className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={t("copyText")} title={t("copyText")}>
                <Copy className="size-3.5" />
              </button>
            )}
            {m.quotable && m.text && (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent<ComposeDetail>(COMPOSE_EVENT, { detail: { mode: "reply", quote: m.text } }))}
                className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label={t("quote")}
                title={t("quote")}
              >
                <Quote className="size-3.5" />
              </button>
            )}
            <MoreMenu m={m} site={site} conversationId={conversationId} />
          </div>
          <div className="absolute right-1 top-1 z-10 [@media(hover:hover)]:hidden">
            <MoreMenu m={m} site={site} conversationId={conversationId} />
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <MessageItems kit={{ Item: ContextMenuItem, Separator: ContextMenuSeparator }} m={m} site={site} conversationId={conversationId} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

function MoreMenu({ m, site, conversationId }: { m: MessageRef; site: string; conversationId: string }) {
  const t = useTranslations("inbox");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground data-[state=open]:bg-accent" aria-label={t("menu.more")}>
        <MoreHorizontal className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <MessageItems kit={{ Item: DropdownMenuItem, Separator: DropdownMenuSeparator }} m={m} site={site} conversationId={conversationId} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Small copy icon next to a value; shows a tick for a moment. */
export function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
  const t = useTranslations("inbox.toast");
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard.writeText(text).then(
          () => {
            setDone(true);
            setTimeout(() => setDone(false), 1200);
          },
          () => toast.error(t("failed")),
        )
      }
      aria-label={label}
      title={label}
      className={cn("inline-grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground", className)}
    >
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}

/** "Copy all" for a form post: every field as `Label: value`. */
export function CopyAllButton({ text, children }: { text: string; children: ReactNode }) {
  const copy = useCopy();
  const t = useTranslations("inbox.form");
  return (
    <button type="button" onClick={() => copy(text, t("allFields"))} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium hover:bg-accent [&_svg]:size-4">
      {children}
    </button>
  );
}

/**
 * The scrolling message list. Opens at a linked message (`#m-<id>`), else at the
 * first new one, else at the bottom, and stays pinned to the bottom while new
 * messages arrive if you were already there. The "New" line survives the refresh
 * that marking the thread read triggers.
 */
export function ThreadScroller({ firstNewId, count, className, children }: { firstNewId: string | null; count: number; className?: string; children: ReactNode }) {
  const t = useTranslations("inbox.thread");
  const ref = useRef<HTMLOListElement>(null);
  const [marker, setMarker] = useState(firstNewId);
  const atBottom = useRef(true);
  const seen = useRef(count);
  useEffect(() => {
    if (firstNewId) setMarker(firstNewId);
  }, [firstNewId]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const hash = location.hash.startsWith("#m-") ? document.getElementById(location.hash.slice(1)) : null;
    const target = hash ?? (marker ? document.getElementById(`m-${marker}`) : null);
    if (target) {
      target.scrollIntoView({ block: hash ? "center" : "start" });
      if (hash) target.setAttribute("data-flash", "");
    } else el.scrollTop = el.scrollHeight;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && count > seen.current && atBottom.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    seen.current = count;
  }, [count]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.querySelectorAll("[data-new]").forEach((n) => n.removeAttribute("data-new"));
    if (marker) el.querySelector(`#m-${CSS.escape(marker)}`)?.setAttribute("data-new", t("newLine"));
  }, [marker, count, t]);

  return (
    <ol
      ref={ref}
      onScroll={(e) => {
        const el = e.currentTarget;
        atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
      className={cn("qb-thread min-h-0 flex-1 overflow-y-auto overscroll-contain", className)}
    >
      {children}
    </ol>
  );
}

/** Below xl the context column lives in a sheet, opened by the Info button or `i`. */
export function ContextSheet({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onInfo = () => setOpen((o) => !o);
    window.addEventListener(INFO_EVENT, onInfo);
    return () => window.removeEventListener(INFO_EVENT, onInfo);
  }, []);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-[22rem] max-w-[90vw] gap-0 overflow-y-auto p-0 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
        <SheetTitle className="border-b px-4 py-3 text-sm">{title}</SheetTitle>
        <SheetDescription className="sr-only">{title}</SheetDescription>
        {children}
      </SheetContent>
    </Sheet>
  );
}

/** Tags on a thread: click × to remove, type and Enter to add. */
export function TagsEditor({ site, conversationId, tags }: { site: string; conversationId: string; tags: string[] }) {
  const t = useTranslations("inbox.tags");
  const { patch } = useInboxActions(site);
  const [value, setValue] = useState("");
  const add = () => {
    const tag = value.trim().toLowerCase();
    if (!tag || tags.includes(tag)) return setValue("");
    patch([conversationId], { addTags: [tag] }, true);
    setValue("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((tag) => (
        <span key={tag} className="inline-flex h-6 items-center gap-0.5 rounded-full border bg-muted/40 pl-2 pr-0.5 text-xs">
          {tag}
          <button type="button" onClick={() => patch([conversationId], { removeTags: [tag] }, true)} className="grid size-5 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={t("remove", { tag })}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, 40))}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder={tags.length ? t("addMore") : t("add")}
        aria-label={t("add")}
        className="h-6 min-w-20 flex-1 rounded-md bg-transparent px-1 text-xs outline-none placeholder:text-muted-foreground/70 focus:bg-muted/40"
      />
    </div>
  );
}
