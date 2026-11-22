"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { SNOOZE_OPTIONS, type SnoozeOption } from "@qubo/inbox";
import { cn } from "@qubo/shared/utils";
import { AlarmClock, ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, Flag, Info, MoreHorizontal, RotateCcw, Ticket, UserRound } from "lucide-react";
import { ConversationMenuItems, dropdownKit, PRIORITY_CHOICES, STATUS_CHOICES } from "@/components/inbox/conversation-menu";
import { channelIcon, shortSubject, statusDot } from "@/components/inbox/icons";
import { OriginBadge } from "@/components/inbox/origin-badge";
import { INFO_EVENT, useInboxActions, type ConvSummary } from "@/components/inbox/use-inbox";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatters } from "@/lib/format";

type Thread = ConvSummary & { channel: keyof typeof channelIcon; createdAt: Date; snoozedUntil: Date | null };

const pill = "flex h-7 shrink-0 items-center gap-1.5 rounded-full border bg-background px-2.5 text-xs hover:bg-accent data-[state=open]:bg-accent";

export function ThreadToolbar({
  site,
  me,
  c,
  members,
  backHref,
  prevHref,
  nextHref,
  position,
}: {
  site: string;
  me: string;
  c: Thread;
  members: { id: string; name: string }[];
  backHref: string;
  prevHref: string | null;
  nextHref: string | null;
  /** "3 / 41" when the thread is in the list. */
  position: string | null;
}) {
  const t = useTranslations("inbox");
  const { shortDate, relativeTime } = formatters(useLocale());
  const { patch, pending } = useInboxActions(site);
  const one = [c.id];
  const subject = shortSubject(c.subject, c.formName);
  const name = c.contactName ?? c.contactEmail ?? t("list.anonymous");
  const resolved = c.status === "resolved";
  const assignee = members.find((m) => m.id === c.assigneeId);
  const nav = "grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground aria-disabled:pointer-events-none aria-disabled:opacity-30";
  return (
    <header className="shrink-0 border-b bg-card" aria-busy={pending}>
      <div className="flex items-center gap-1 px-2 pt-2 sm:px-3">
        <Link href={backHref} scroll={false} className={cn(nav, "-ml-1 md:hidden")} aria-label={t("thread.back")}>
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1 px-1">
          <h2 className="truncate text-[15px] font-semibold leading-tight">{subject || name}</h2>
          <p className="truncate text-xs text-muted-foreground [&>span+span]:before:content-['_·_']">
            {subject && subject !== name && <span>{name}</span>}
            {c.contactEmail && c.contactEmail !== name && <span>{c.contactEmail}</span>}
            <span suppressHydrationWarning>{shortDate(c.createdAt)}</span>
          </p>
        </div>
        <div className="hidden items-center sm:flex">
          {position && <span className="mr-1 hidden text-xs tabular-nums text-muted-foreground lg:inline">{position}</span>}
          <Link href={prevHref ?? "#"} scroll={false} aria-disabled={!prevHref} className={nav} aria-label={t("thread.prev")} title={`${t("thread.prev")} (k)`}>
            <ChevronLeft className="size-4" />
          </Link>
          <Link href={nextHref ?? "#"} scroll={false} aria-disabled={!nextHref} className={nav} aria-label={t("thread.next")} title={`${t("thread.next")} (j)`}>
            <ChevronRight className="size-4" />
          </Link>
        </div>
        <Button variant="outline" size="sm" className="h-8 px-2.5 max-sm:w-8 max-sm:px-0" onClick={() => patch(one, { status: resolved ? "open" : "resolved" }, true)} title={`${resolved ? t("thread.reopen") : t("thread.resolve")} (e)`}>
          {resolved ? <RotateCcw /> : <CircleCheck />}
          <span className="max-sm:sr-only">{resolved ? t("thread.reopen") : t("thread.resolve")}</span>
        </Button>
        <Button variant="ghost" size="icon-sm" className="xl:hidden" onClick={() => window.dispatchEvent(new Event(INFO_EVENT))} aria-label={t("thread.info")} title={`${t("thread.info")} (i)`}>
          <Info />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t("menu.more")} title={t("menu.more")}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <ConversationMenuItems kit={dropdownKit} c={c} site={site} members={members} me={me} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto px-3 pb-2 pt-1.5 [scrollbar-width:none] sm:px-4">
        <OriginBadge channel={c.channel} label={c.formName ?? t(`origins.${c.channel}`)} className="h-7 rounded-full px-2.5 text-xs [&_svg]:size-3.5" />
        {c.ticketNumber !== null && (
          <span className="flex h-7 shrink-0 items-center gap-1 rounded-full border border-dashed px-2.5 text-xs tabular-nums text-muted-foreground">
            <Ticket className="size-3.5" />#{c.ticketNumber}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger className={pill} aria-label={t("controls.status")}>
            <span className={cn("size-2 rounded-full", statusDot[c.status])} />
            {t(`statuses.${c.status as "open"}`)}
            {c.status === "snoozed" && c.snoozedUntil && <span className="text-muted-foreground" suppressHydrationWarning>· {relativeTime(c.snoozedUntil)}</span>}
            <ChevronDown className="size-3 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuRadioGroup value={c.status} onValueChange={(v) => patch(one, { status: v as "open" }, true)}>
              {STATUS_CHOICES.map((s) => (
                <DropdownMenuRadioItem key={s} value={s}>
                  <span className={cn("size-2 rounded-full", statusDot[s])} /> {t(`statuses.${s}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger className={pill} aria-label={t("controls.priority")}>
            <Flag className={cn("size-3.5", c.priority === "urgent" ? "text-red-600/70" : c.priority === "high" ? "text-amber-600/80" : "text-muted-foreground")} />
            {t(`priorities.${c.priority as "normal"}`)}
            <ChevronDown className="size-3 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuRadioGroup value={c.priority} onValueChange={(v) => patch(one, { priority: v as "high" }, true)}>
              {PRIORITY_CHOICES.map((p) => (
                <DropdownMenuRadioItem key={p} value={p}>
                  {t(`priorities.${p}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger className={cn(pill, "max-w-48")} aria-label={t("controls.assignee")}>
            <UserRound className="size-3.5 text-muted-foreground" />
            <span className="truncate">{assignee ? (assignee.id === me ? t("list.filters.me") : assignee.name) : t("controls.unassigned")}</span>
            <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuRadioGroup value={c.assigneeId ?? ""} onValueChange={(v) => patch(one, { assigneeId: v || null }, true)}>
              <DropdownMenuRadioItem value="">{t("controls.unassigned")}</DropdownMenuRadioItem>
              {members.map((m) => (
                <DropdownMenuRadioItem key={m.id} value={m.id}>
                  {m.id === me ? t("menu.me", { name: m.name }) : m.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {!resolved && (
          <DropdownMenu>
            <DropdownMenuTrigger className={pill} aria-label={t("controls.snooze")}>
              <AlarmClock className="size-3.5 text-muted-foreground" />
              {t("controls.snooze")}
              <ChevronDown className="size-3 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              {(Object.keys(SNOOZE_OPTIONS) as SnoozeOption[]).map((k) => (
                <DropdownMenuItem key={k} onSelect={() => patch(one, { snooze: k }, true)}>
                  {t(`controls.snoozeOptions.${k}`)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
