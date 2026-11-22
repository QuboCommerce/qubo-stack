"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useEvent } from "@qubo/realtime/client";
import { markReadAction } from "@/app/inbox-actions";

/** Any inbox change on this site refreshes server data (sidebar badge, open inbox). */
export function InboxLive({ siteId }: { siteId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEvent(["conversation.created", "conversation.message", "conversation.updated"], (e) => {
    if (e.siteId !== siteId) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), 300);
  });
  return null;
}

/**
 * Opening an unread thread marks it read, and so does a new message arriving
 * while it is open. A thread someone marks unread while it is open stays unread.
 */
export function MarkRead({ site, conversationId, unread, count }: { site: string; conversationId: string; unread: boolean; count: number }) {
  const seen = useRef<{ id: string; count: number } | null>(null);
  useEffect(() => {
    const fresh = seen.current?.id !== conversationId;
    const grew = !fresh && count > (seen.current?.count ?? 0);
    seen.current = { id: conversationId, count };
    if (unread && (fresh || grew)) void markReadAction(site, conversationId);
  }, [site, conversationId, unread, count]);
  return null;
}
