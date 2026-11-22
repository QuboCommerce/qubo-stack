"use client";

import type { ComponentType } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SNOOZE_OPTIONS, type SnoozeOption } from "@qubo/inbox";
import { AlarmClock, Ban, Copy, ExternalLink, Flag, Mail, MailOpen, Search, Ticket, TicketPlus, UserRound, CircleDot } from "lucide-react";
import * as CM from "@/components/ui/context-menu";
import * as DM from "@/components/ui/dropdown-menu";
import { conversationLink, useCopy, useInboxActions, type ConvSummary } from "@/components/inbox/use-inbox";

/* eslint-disable @typescript-eslint/no-explicit-any */
type C = ComponentType<any>;
export type MenuKit = { Item: C; Sub: C; SubTrigger: C; SubContent: C; Separator: C; RadioGroup: C; RadioItem: C; Shortcut: C; Label: C };

export const contextKit: MenuKit = {
  Item: CM.ContextMenuItem,
  Sub: CM.ContextMenuSub,
  SubTrigger: CM.ContextMenuSubTrigger,
  SubContent: CM.ContextMenuSubContent,
  Separator: CM.ContextMenuSeparator,
  RadioGroup: CM.ContextMenuRadioGroup,
  RadioItem: CM.ContextMenuRadioItem,
  Shortcut: CM.ContextMenuShortcut,
  Label: CM.ContextMenuLabel,
};

export const dropdownKit: MenuKit = {
  Item: DM.DropdownMenuItem,
  Sub: DM.DropdownMenuSub,
  SubTrigger: DM.DropdownMenuSubTrigger,
  SubContent: DM.DropdownMenuSubContent,
  Separator: DM.DropdownMenuSeparator,
  RadioGroup: DM.DropdownMenuRadioGroup,
  RadioItem: DM.DropdownMenuRadioItem,
  Shortcut: DM.DropdownMenuShortcut,
  Label: DM.DropdownMenuLabel,
};

export const STATUS_CHOICES = ["open", "pending", "resolved"] as const;
export const PRIORITY_CHOICES = ["urgent", "high", "normal", "low"] as const;

/**
 * Everything you can do to one conversation. Rendered as the list's right-click
 * menu and the thread's "more" menu, so both always offer the same things.
 */
export function ConversationMenuItems({
  kit: K,
  c,
  site,
  members,
  me,
  href,
}: {
  kit: MenuKit;
  c: ConvSummary;
  site: string;
  members: { id: string; name: string }[];
  me: string;
  /** Set in the list: adds "Open in new tab". */
  href?: string;
}) {
  const t = useTranslations("inbox");
  const router = useRouter();
  const copy = useCopy();
  const { patch, ticket } = useInboxActions(site);
  const spam = c.tags.includes("spam");
  const one = [c.id];
  return (
    <>
      {href && (
        <K.Item onSelect={() => window.open(href, "_blank", "noopener")}>
          <ExternalLink /> {t("menu.openNewTab")}
        </K.Item>
      )}
      <K.Item onSelect={() => patch(one, { unread: !c.unread })}>
        {c.unread ? <MailOpen /> : <Mail />} {c.unread ? t("menu.markRead") : t("menu.markUnread")}
        <K.Shortcut>U</K.Shortcut>
      </K.Item>
      <K.Sub>
        <K.SubTrigger>
          <CircleDot /> {t("menu.status")}
        </K.SubTrigger>
        <K.SubContent>
          <K.RadioGroup value={c.status} onValueChange={(v: string) => patch(one, { status: v as "open" })}>
            {STATUS_CHOICES.map((s) => (
              <K.RadioItem key={s} value={s}>
                {t(`statuses.${s}`)}
              </K.RadioItem>
            ))}
          </K.RadioGroup>
        </K.SubContent>
      </K.Sub>
      {c.status !== "resolved" && (
        <K.Sub>
          <K.SubTrigger>
            <AlarmClock /> {t("menu.snooze")}
          </K.SubTrigger>
          <K.SubContent>
            {(Object.keys(SNOOZE_OPTIONS) as SnoozeOption[]).map((k) => (
              <K.Item key={k} onSelect={() => patch(one, { snooze: k })}>
                {t(`controls.snoozeOptions.${k}`)}
              </K.Item>
            ))}
          </K.SubContent>
        </K.Sub>
      )}
      <K.Sub>
        <K.SubTrigger>
          <Flag /> {t("menu.priority")}
        </K.SubTrigger>
        <K.SubContent>
          <K.RadioGroup value={c.priority} onValueChange={(v: string) => patch(one, { priority: v as "high" })}>
            {PRIORITY_CHOICES.map((p) => (
              <K.RadioItem key={p} value={p}>
                {t(`priorities.${p}`)}
              </K.RadioItem>
            ))}
          </K.RadioGroup>
        </K.SubContent>
      </K.Sub>
      <K.Sub>
        <K.SubTrigger>
          <UserRound /> {t("menu.assign")}
        </K.SubTrigger>
        <K.SubContent>
          <K.RadioGroup value={c.assigneeId ?? ""} onValueChange={(v: string) => patch(one, { assigneeId: v || null })}>
            <K.RadioItem value="">{t("controls.unassigned")}</K.RadioItem>
            {members.map((m) => (
              <K.RadioItem key={m.id} value={m.id}>
                {m.id === me ? t("menu.me", { name: m.name }) : m.name}
              </K.RadioItem>
            ))}
          </K.RadioGroup>
        </K.SubContent>
      </K.Sub>
      {c.ticketNumber === null && (
        <K.Item onSelect={() => ticket(c.id)}>
          <TicketPlus /> {t("thread.makeTicket")}
          <K.Shortcut>T</K.Shortcut>
        </K.Item>
      )}
      <K.Separator />
      <K.Sub>
        <K.SubTrigger>
          <Copy /> {t("menu.copy")}
        </K.SubTrigger>
        <K.SubContent>
          <K.Item onSelect={() => copy(conversationLink(site, c.id), t("menu.what.link"))}>{t("menu.copyLink")}</K.Item>
          {c.contactEmail && <K.Item onSelect={() => copy(c.contactEmail!, c.contactEmail!)}>{t("menu.copyEmail")}</K.Item>}
          {c.phone && <K.Item onSelect={() => copy(c.phone!, c.phone!)}>{t("menu.copyPhone")}</K.Item>}
          {c.contactName && <K.Item onSelect={() => copy(c.contactName!, c.contactName!)}>{t("menu.copyName")}</K.Item>}
          <K.Item onSelect={() => copy(c.subject, t("menu.what.subject"))}>{t("menu.copySubject")}</K.Item>
          {c.ticketNumber !== null && (
            <K.Item onSelect={() => copy(`#${c.ticketNumber}`, `#${c.ticketNumber}`)}>
              <Ticket /> {t("menu.copyTicket")}
            </K.Item>
          )}
        </K.SubContent>
      </K.Sub>
      {c.contactEmail && (
        <K.Item onSelect={() => router.push(`/${site}/inbox?view=all&q=${encodeURIComponent(c.contactEmail!)}`)}>
          <Search /> {t("menu.fromContact")}
        </K.Item>
      )}
      <K.Separator />
      <K.Item variant={spam ? "default" : "destructive"} onSelect={() => patch(one, { spam: !spam })}>
        <Ban /> {spam ? t("menu.notSpam") : t("menu.spam")}
      </K.Item>
    </>
  );
}
