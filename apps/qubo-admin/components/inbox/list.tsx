"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { slaState, SNOOZE_OPTIONS, type SnoozeOption } from "@qubo/inbox";
import { cn } from "@qubo/shared/utils";
import {
  AlarmClock,
  Ban,
  Check,
  ChevronDown,
  CircleCheck,
  CircleDot,
  Flag,
  Keyboard,
  ListChecks,
  ListFilter,
  Mail,
  MailOpen,
  MoreHorizontal,
  Search,
  Ticket,
  UserRound,
  X,
} from "lucide-react";
import { ConversationMenuItems, contextKit, dropdownKit, PRIORITY_CHOICES, STATUS_CHOICES } from "@/components/inbox/conversation-menu";
import { channelIcon } from "@/components/inbox/icons";
import { COMPOSE_EVENT, INBOX_SEARCH_ID, INFO_EVENT, useInboxActions, type ComposeDetail, type ConvSummary } from "@/components/inbox/use-inbox";
import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { formatters } from "@/lib/format";
import type { ConversationRow } from "@/lib/inbox";
import { INBOX_LENSES, INBOX_SORTS, INBOX_VIEWS, inboxHref, LIST_LIMIT, type InboxLens, type InboxState, type InboxView } from "@/lib/inbox-shared";

type Member = { id: string; name: string };

const summary = (r: ConversationRow): ConvSummary => ({ ...r });

export function InboxList({
  site,
  me,
  state,
  rows,
  counts,
  lensCounts,
  members,
  current,
  inboundAddress,
}: {
  site: string;
  me: string;
  state: InboxState;
  rows: ConversationRow[];
  counts: Record<Exclude<InboxView, "all">, number>;
  lensCounts: Record<InboxLens, number>;
  members: Member[];
  /** The open thread, also when the filters hide it from the list. */
  current: ConvSummary | null;
  inboundAddress: string | null;
}) {
  const t = useTranslations("inbox");
  const router = useRouter();
  const go = (next: Partial<InboxState>) => inboxHref(site, { ...state, ...next });
  const actions = useInboxActions(site);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [help, setHelp] = useState(false);
  const anchor = useRef<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [q, setQ] = useState(state.q ?? "");
  useEffect(() => setQ(state.q ?? ""), [state.q]);

  // Threads that left the list (filters, actions) leave the selection too.
  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  useEffect(() => {
    setSelected((s) => {
      const kept = new Set([...s].filter((id) => ids.includes(id)));
      return kept.size === s.size ? s : kept;
    });
  }, [ids]);

  const selecting = selectMode || selected.size > 0;
  const toggle = (id: string, index: number, range: boolean) => {
    setSelected((s) => {
      const next = new Set(s);
      if (range && anchor.current !== null) {
        const [a, b] = [Math.min(anchor.current, index), Math.max(anchor.current, index)];
        const on = !s.has(id);
        for (const r of rows.slice(a, b + 1)) on ? next.add(r.id) : next.delete(r.id);
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    anchor.current = index;
  };
  const clear = () => {
    setSelected(new Set());
    setSelectMode(false);
    anchor.current = null;
  };
  const bulk = (p: Parameters<typeof actions.patch>[1]) => {
    actions.patch([...selected], p);
    clear();
  };

  // Keyboard: Gmail-like single keys, ignored while typing or with modifiers.
  const live = useRef({ rows, state, current, selected, go, bulk });
  live.current = { rows, state, current, selected, go, bulk };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (document.querySelector("[role=menu], [role=dialog]")) return;
      const { rows, state, current, selected, go, bulk } = live.current;
      const i = rows.findIndex((r) => r.id === state.c);
      const open = (r?: ConversationRow) => {
        if (!r) return;
        router.push(go({ c: r.id }), { scroll: false });
        listRef.current?.querySelector(`[data-id="${r.id}"]`)?.scrollIntoView({ block: "nearest" });
      };
      const target = selected.size ? [...selected] : current ? [current.id] : [];
      const compose = (mode: ComposeDetail["mode"]) => current && window.dispatchEvent(new CustomEvent<ComposeDetail>(COMPOSE_EVENT, { detail: { mode } }));
      const run: Record<string, () => void> = {
        j: () => open(rows[i < 0 ? 0 : i + 1]),
        ArrowDown: () => open(rows[i < 0 ? 0 : i + 1]),
        k: () => open(rows[i < 0 ? 0 : i - 1]),
        ArrowUp: () => open(rows[i < 0 ? 0 : i - 1]),
        Escape: () => (selected.size ? clear() : state.c && router.push(go({ c: undefined }), { scroll: false })),
        r: () => compose("reply"),
        n: () => compose("note"),
        e: () => target.length && (selected.size ? bulk({ status: "resolved" }) : actions.patch(target, { status: current?.status === "resolved" ? "open" : "resolved" })),
        u: () => target.length && (selected.size ? bulk({ unread: true }) : actions.patch(target, { unread: !current?.unread })),
        a: () => target.length && (selected.size ? bulk({ assigneeId: me }) : actions.patch(target, { assigneeId: me })),
        t: () => current && current.ticketNumber === null && actions.ticket(current.id),
        x: () => current && toggle(current.id, Math.max(i, 0), false),
        i: () => current && window.dispatchEvent(new Event(INFO_EVENT)),
        "/": () => document.getElementById(INBOX_SEARCH_ID)?.focus(),
        "?": () => setHelp(true),
      };
      const fn = run[e.key];
      if (!fn) return;
      e.preventDefault();
      fn();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const assigneeName = (id: string) => (id === "me" ? t("list.filters.me") : id === "none" ? t("controls.unassigned") : (members.find((m) => m.id === id)?.name ?? id));
  const chips = [
    state.q && { key: "q", label: `“${state.q}”`, href: go({ q: undefined, c: undefined }) },
    state.unread && { key: "unread", label: t("list.filters.unreadOnly"), href: go({ unread: false, c: undefined }) },
    state.priority && { key: "priority", label: t("list.filters.highOnly"), href: go({ priority: false, c: undefined }) },
    state.assignee && { key: "assignee", label: assigneeName(state.assignee), href: go({ assignee: undefined, c: undefined }) },
    state.sort !== "newest" && { key: "sort", label: t(`list.sorts.${state.sort}`), href: go({ sort: "newest" }) },
  ].filter(Boolean) as { key: string; label: string; href: string }[];
  const allSelected = rows.length > 0 && selected.size === rows.length;

  return (
    <>
      <header className="shrink-0 border-b">
        <div className="flex items-center gap-1 px-2 pt-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-[15px] font-semibold hover:bg-accent">
              <span className="truncate">{t(`lenses.${state.lens}.title`)}</span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t("lenses.label")}</DropdownMenuLabel>
              {INBOX_LENSES.map((l) => (
                <DropdownMenuItem key={l} onSelect={() => router.push(inboxHref(site, { ...state, lens: l, c: undefined }))}>
                  {l === state.lens ? <Check /> : <span className="size-4" />}
                  {t(`lenses.${l}.tab`)}
                  {lensCounts[l] > 0 && <span className="ml-auto text-xs tabular-nums text-muted-foreground">{lensCounts[l]}</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-pressed={selecting}
            onClick={() => (selecting ? clear() : setSelectMode(true))}
            title={t("list.selectMode")}
            aria-label={t("list.selectMode")}
            className={cn(selecting && "bg-accent")}
          >
            <ListChecks />
          </Button>
          <FilterMenu state={state} go={go} members={members} me={me} onHelp={() => setHelp(true)} />
        </div>
        <form
          role="search"
          className="px-2 pt-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(go({ q: q.trim() || undefined, c: undefined }));
          }}
        >
          <label className="flex items-center gap-2 rounded-lg border bg-background px-2.5 focus-within:ring-2 focus-within:ring-ring/30">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              id={INBOX_SEARCH_ID}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && (e.currentTarget.blur(), setQ(state.q ?? ""))}
              placeholder={t("list.searchPlaceholder")}
              enterKeyHint="search"
              className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {q && (
              <button type="button" onClick={() => (setQ(""), state.q && router.push(go({ q: undefined, c: undefined })))} aria-label={t("list.clearSearch")} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            )}
          </label>
        </form>
        {selecting ? (
          <BulkBar
            count={selected.size}
            all={allSelected}
            onAll={() => setSelected(allSelected ? new Set() : new Set(ids))}
            onClear={clear}
            bulk={bulk}
            members={members}
            me={me}
          />
        ) : (
          <div className="flex items-center gap-1 overflow-x-auto px-2 py-1.5 [scrollbar-width:none]">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[13px] font-medium hover:bg-accent">
                {t(`views.${state.view}`)}
                {state.view !== "all" && <span className="tabular-nums text-muted-foreground">{counts[state.view]}</span>}
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuRadioGroup value={state.view} onValueChange={(v) => router.push(go({ view: v as InboxView, c: undefined }))}>
                  {INBOX_VIEWS.map((v) => (
                    <DropdownMenuRadioItem key={v} value={v}>
                      {t(`views.${v}`)}
                      {v !== "all" && <span className="ml-auto text-xs tabular-nums text-muted-foreground">{counts[v]}</span>}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            {chips.map((c) => (
              <Link key={c.key} href={c.href} className="flex h-6 max-w-40 shrink-0 items-center gap-1 rounded-full border bg-muted/40 pl-2 pr-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
                <span className="truncate">{c.label}</span>
                <X className="size-3 shrink-0" aria-label={t("list.filters.remove")} />
              </Link>
            ))}
          </div>
        )}
      </header>

      <ul ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-busy={actions.pending}>
        {rows.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">{chips.length ? t("list.noMatches") : t(`lenses.${state.lens}.empty`)}</li>}
        {rows.map((r, i) => (
          <Row
            key={r.id}
            row={r}
            index={i}
            site={site}
            me={me}
            members={members}
            href={go({ c: r.id })}
            active={r.id === state.c}
            selecting={selecting}
            selected={selected.has(r.id)}
            onToggle={toggle}
          />
        ))}
        {rows.length >= LIST_LIMIT && <li className="px-3 py-4 text-center text-xs text-muted-foreground">{t("list.limit", { count: LIST_LIMIT })}</li>}
      </ul>
      {inboundAddress && (state.lens === "all" || state.lens === "email") && (
        <p className="shrink-0 truncate border-t px-3 py-2 text-xs text-muted-foreground" title={t("list.inboundAddressHint")}>
          {t.rich("list.inboundAddress", { address: inboundAddress, code: (c) => <span className="select-all font-mono text-foreground">{c}</span> })}
        </p>
      )}
      <ShortcutsDialog open={help} onOpenChange={setHelp} />
    </>
  );
}

function FilterMenu({ state, go, members, me, onHelp }: { state: InboxState; go: (n: Partial<InboxState>) => string; members: Member[]; me: string; onHelp: () => void }) {
  const t = useTranslations("inbox");
  const router = useRouter();
  const nav = (n: Partial<InboxState>) => router.push(go({ ...n, c: undefined }));
  const active = state.unread || state.priority || Boolean(state.assignee) || state.sort !== "newest";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t("list.filters.label")} title={t("list.filters.label")} className={cn("relative", active && "bg-accent")}>
          <ListFilter />
          {active && <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-foreground/60" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t("list.filters.show")}</DropdownMenuLabel>
        <DropdownMenuCheckboxItem checked={state.unread} onCheckedChange={(v) => nav({ unread: v })}>
          {t("list.filters.unreadOnly")}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={state.priority} onCheckedChange={(v) => nav({ priority: v })}>
          {t("list.filters.highOnly")}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="pl-8">{t("list.filters.assignee")}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={state.assignee ?? ""} onValueChange={(v) => nav({ assignee: v || undefined })}>
              <DropdownMenuRadioItem value="">{t("list.filters.anyone")}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="me">{t("list.filters.me")}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="none">{t("controls.unassigned")}</DropdownMenuRadioItem>
              {members
                .filter((m) => m.id !== me)
                .map((m) => (
                  <DropdownMenuRadioItem key={m.id} value={m.id}>
                    {m.name}
                  </DropdownMenuRadioItem>
                ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t("list.filters.sort")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={state.sort} onValueChange={(v) => nav({ sort: v as InboxState["sort"] })}>
          {INBOX_SORTS.map((s) => (
            <DropdownMenuRadioItem key={s} value={s}>
              {t(`list.sorts.${s}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {active && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => nav({ unread: false, priority: false, assignee: undefined, sort: "newest" })}>
              <X /> {t("list.filters.reset")}
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onHelp} className="hidden [@media(hover:hover)]:flex">
          <Keyboard /> {t("shortcuts.title")}
          <DropdownMenuShortcutText>?</DropdownMenuShortcutText>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const DropdownMenuShortcutText = ({ children }: { children: React.ReactNode }) => <span className="ml-auto text-xs text-muted-foreground">{children}</span>;

function BulkBar({
  count,
  all,
  onAll,
  onClear,
  bulk,
  members,
  me,
}: {
  count: number;
  all: boolean;
  onAll: () => void;
  onClear: () => void;
  bulk: (p: Parameters<ReturnType<typeof useInboxActions>["patch"]>[1]) => void;
  members: Member[];
  me: string;
}) {
  const t = useTranslations("inbox");
  const none = count === 0;
  const icon = "size-7 [&_svg]:size-4";
  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5">
      <button type="button" role="checkbox" aria-checked={all ? true : count ? "mixed" : false} onClick={onAll} aria-label={t("bulk.selectAll")} className="grid size-7 place-items-center rounded-md hover:bg-accent">
        <Box on={all} mixed={!all && count > 0} />
      </button>
      <span className="min-w-0 flex-1 truncate px-1 text-[13px] tabular-nums text-muted-foreground">{none ? t("bulk.pick") : t("bulk.selected", { count })}</span>
      <Button variant="ghost" size="icon-sm" className={icon} disabled={none} onClick={() => bulk({ unread: false })} title={t("menu.markRead")} aria-label={t("menu.markRead")}>
        <MailOpen />
      </Button>
      <Button variant="ghost" size="icon-sm" className={icon} disabled={none} onClick={() => bulk({ unread: true })} title={t("menu.markUnread")} aria-label={t("menu.markUnread")}>
        <Mail />
      </Button>
      <Button variant="ghost" size="icon-sm" className={icon} disabled={none} onClick={() => bulk({ status: "resolved" })} title={t("thread.resolve")} aria-label={t("thread.resolve")}>
        <CircleCheck />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" className={icon} disabled={none} aria-label={t("menu.more")} title={t("menu.more")}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <CircleDot /> {t("menu.status")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {STATUS_CHOICES.map((s) => (
                <DropdownMenuItem key={s} onSelect={() => bulk({ status: s })}>
                  {t(`statuses.${s}`)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <AlarmClock /> {t("menu.snooze")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {(Object.keys(SNOOZE_OPTIONS) as SnoozeOption[]).map((k) => (
                <DropdownMenuItem key={k} onSelect={() => bulk({ snooze: k })}>
                  {t(`controls.snoozeOptions.${k}`)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Flag /> {t("menu.priority")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {PRIORITY_CHOICES.map((p) => (
                <DropdownMenuItem key={p} onSelect={() => bulk({ priority: p })}>
                  {t(`priorities.${p}`)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <UserRound /> {t("menu.assign")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onSelect={() => bulk({ assigneeId: null })}>{t("controls.unassigned")}</DropdownMenuItem>
              {members.map((m) => (
                <DropdownMenuItem key={m.id} onSelect={() => bulk({ assigneeId: m.id })}>
                  {m.id === me ? t("menu.me", { name: m.name }) : m.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => bulk({ spam: false })}>
            <Ban /> {t("menu.notSpam")}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => bulk({ spam: true })}>
            <Ban /> {t("menu.spam")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button variant="ghost" size="icon-sm" className={icon} onClick={onClear} title={t("bulk.done")} aria-label={t("bulk.done")}>
        <X />
      </Button>
    </div>
  );
}

const Box = ({ on, mixed }: { on: boolean; mixed?: boolean }) => (
  <span className={cn("grid size-4 place-items-center rounded-[4px] border border-foreground/30 bg-background", (on || mixed) && "border-foreground/70 bg-foreground/70 text-background")}>
    {on ? <Check className="size-3" strokeWidth={3} /> : mixed ? <span className="h-0.5 w-2 rounded bg-background" /> : null}
  </span>
);

const slaText = { warn: "text-amber-700/90 dark:text-amber-400/80", breach: "text-red-700/80 dark:text-red-400/80" } as const;
const flagTone: Record<string, string> = { urgent: "text-red-600/70 dark:text-red-400/70", high: "text-amber-600/80 dark:text-amber-400/70" };

function waitLabel(t: ReturnType<typeof useTranslations<"inbox">>, ms: number) {
  if (ms < 3_600_000) return t("list.waitMinutes", { count: Math.max(1, Math.round(ms / 60_000)) });
  if (ms < 48 * 3_600_000) return t("list.waitHours", { count: Math.round(ms / 3_600_000) });
  return t("list.waitDays", { count: Math.round(ms / 86_400_000) });
}

function Row({
  row,
  index,
  site,
  me,
  members,
  href,
  active,
  selecting,
  selected,
  onToggle,
}: {
  row: ConversationRow;
  index: number;
  site: string;
  me: string;
  members: Member[];
  href: string;
  active: boolean;
  selecting: boolean;
  selected: boolean;
  onToggle: (id: string, index: number, range: boolean) => void;
}) {
  const t = useTranslations("inbox");
  const { relativeTime } = formatters(useLocale());
  const menuAt = useRef(0);
  const Icon = channelIcon[row.channel];
  const sla = slaState(row.status, row.lastFrom, row.lastMessageAt);
  const category = row.tags.find((x) => x.startsWith("ai:"))?.slice(3);
  const name = row.contactName ?? row.contactEmail ?? t("list.anonymous");
  const showSubject = row.subject && row.subject.trim().toLowerCase() !== name.trim().toLowerCase();
  const assignee = row.assigneeId && row.assigneeId !== me ? members.find((m) => m.id === row.assigneeId)?.name : null;
  return (
    <ContextMenu onOpenChange={(o) => o && (menuAt.current = Date.now())}>
      <ContextMenuTrigger asChild>
        <li data-id={row.id} className={cn("group relative border-b [-webkit-touch-callout:none]", active ? "bg-accent" : selected ? "bg-accent/50" : "hover:bg-accent/40")}>
          <button
            type="button"
            role="checkbox"
            aria-checked={selected}
            aria-label={t("bulk.select", { name })}
            onClick={(e) => onToggle(row.id, index, e.shiftKey)}
            className={cn("absolute left-1 top-2 z-10 grid size-8 place-items-center rounded-md", selecting ? "opacity-100" : "opacity-0 focus-visible:opacity-100 [@media(hover:hover)]:group-hover:opacity-100")}
          >
            <Box on={selected} />
          </button>
          <Link
            href={href}
            scroll={false}
            aria-current={active ? "true" : undefined}
            onClick={(e) => {
              // A long press opened the menu: the lifting finger must not also open the thread.
              if (Date.now() - menuAt.current < 800) return e.preventDefault();
              if (selecting || e.shiftKey) {
                e.preventDefault();
                onToggle(row.id, index, e.shiftKey);
              }
            }}
            className="flex gap-2.5 py-2.5 pl-2.5 pr-3 outline-none focus-visible:bg-accent"
          >
            <span className={cn("relative mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition-opacity", selecting ? "opacity-0" : "[@media(hover:hover)]:group-hover:opacity-0")}>
              <Icon className="size-3.5" aria-label={t(`origins.${row.channel}`)} />
              {row.unread && <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-card bg-sky-500" aria-label={t("list.unread")} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <span className={cn("min-w-0 flex-1 truncate text-sm", row.unread ? "font-semibold" : "font-medium text-foreground/90")}>{name}</span>
                <time className={cn("shrink-0 text-xs", row.unread ? "text-foreground" : "text-muted-foreground")} dateTime={row.lastMessageAt.toISOString()} suppressHydrationWarning>
                  {relativeTime(row.lastMessageAt)}
                </time>
              </span>
              {showSubject && <span className={cn("mt-0.5 block truncate text-[13px]", row.unread ? "text-foreground" : "text-foreground/80")}>{row.subject}</span>}
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {row.lastFrom === "staff" && t("list.you")}
                {row.preview}
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground empty:hidden">
                {row.ticketNumber !== null && (
                  <span className="inline-flex items-center gap-0.5 rounded border px-1 tabular-nums">
                    <Ticket className="size-3" />#{row.ticketNumber}
                  </span>
                )}
                {flagTone[row.priority] && (
                  <span className={cn("inline-flex items-center gap-0.5", flagTone[row.priority])}>
                    <Flag className="size-3" /> {t(`priorities.${row.priority as "high"}`)}
                  </span>
                )}
                {sla && sla.level !== "ok" && (
                  <span className={slaText[sla.level]} title={t("list.waitingHint")} suppressHydrationWarning>
                    {t("list.waiting", { time: waitLabel(t, sla.waitingMs) })}
                  </span>
                )}
                {row.status === "snoozed" && row.snoozedUntil && (
                  <span className="inline-flex items-center gap-0.5" suppressHydrationWarning>
                    <AlarmClock className="size-3" /> {t("list.wakes", { time: relativeTime(row.snoozedUntil) })}
                  </span>
                )}
                {row.status === "pending" && <span>{t("statuses.pending")}</span>}
                {assignee && (
                  <span className="inline-flex items-center gap-0.5">
                    <UserRound className="size-3" /> {assignee}
                  </span>
                )}
                {row.assigneeId === me && <span>{t("list.mine")}</span>}
                {row.tags.includes("spam") && <span className="text-red-700/70 dark:text-red-400/70">{t("list.spam")}</span>}
                {category && <span>{category}</span>}
              </span>
            </span>
          </Link>
        </li>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-60">
        <ConversationMenuItems kit={contextKit} c={summary(row)} site={site} members={members} me={me} href={href} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

const SHORTCUTS: [string[], string][] = [
  [["j", "↓"], "next"],
  [["k", "↑"], "prev"],
  [["Esc"], "close"],
  [["r"], "reply"],
  [["n"], "note"],
  [["e"], "resolve"],
  [["u"], "unread"],
  [["a"], "assign"],
  [["t"], "ticket"],
  [["x"], "select"],
  [["i"], "info"],
  [["/"], "search"],
  [["⌘/Ctrl", "Enter"], "send"],
  [["⌘/Ctrl", "⇧", "Enter"], "sendResolve"],
  [["?"], "help"],
];

function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("inbox.shortcuts");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
          {SHORTCUTS.map(([keys, k]) => (
            <div key={k} className="contents">
              <dt className="flex gap-1">
                {keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </dt>
              <dd className="text-muted-foreground">{t(`keys.${k}` as "keys.next")}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
