"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { escalateAction, markUnreadAction, patchConversationsAction, type ConversationsPatch } from "@/app/inbox-actions";

/** Other parts of the thread (form card, menus, keys) ask the composer to open in a mode. */
export const COMPOSE_EVENT = "qb:compose";
export type ComposeDetail = { mode: "reply" | "note"; quote?: string };

export const INBOX_SEARCH_ID = "qb-inbox-search";
/** The thread's Info button and the `i` key open the context sheet below xl. */
export const INFO_EVENT = "qb:inbox-info";

/** What menus need to know about a conversation (list row or open thread). */
export type ConvSummary = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  unread: boolean;
  tags: string[];
  ticketNumber: number | null;
  contactEmail: string | null;
  contactName: string | null;
  phone?: string | null;
  formName?: string | null;
};

export function useCopy() {
  const t = useTranslations("inbox.toast");
  return (text: string, what?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(
      () => toast.success(what ? t("copiedWhat", { what }) : t("copied")),
      () => toast.error(t("failed")),
    );
  };
}

/** Inbox writes with a toast; the server action revalidates, so the page refreshes itself. */
export function useInboxActions(site: string) {
  const t = useTranslations("inbox.toast");
  const [pending, start] = useTransition();
  const fail = () => toast.error(t("failed"));
  const patch = (ids: string[], p: ConversationsPatch, quiet = false) =>
    start(async () => {
      try {
        const { count } = await patchConversationsAction(site, ids, p);
        if (!quiet || ids.length > 1) toast.success(t("updated", { count }));
      } catch {
        fail();
      }
    });
  const ticket = (id: string) =>
    start(async () => {
      const fd = new FormData();
      fd.set("site", site);
      fd.set("id", id);
      try {
        const { number } = await escalateAction(fd);
        if (number) toast.success(t("ticket", { number }));
      } catch {
        fail();
      }
    });
  const unreadFrom = (id: string, messageId?: string) =>
    start(async () => {
      try {
        await markUnreadAction(site, id, messageId);
        toast.success(t("markedUnread"));
      } catch {
        fail();
      }
    });
  return { pending, patch, ticket, unreadFrom };
}

/** Absolute link to a conversation (and optionally one message) that any teammate can open. */
export const conversationLink = (site: string, id: string, messageId?: string) =>
  `${location.origin}/${site}/inbox?view=all&c=${id}${messageId ? `#m-${messageId}` : ""}`;
