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

/** Opening an unread thread marks it read once. */
export function MarkRead({ site, conversationId, unread }: { site: string; conversationId: string; unread: boolean }) {
  const done = useRef<string | null>(null);
  useEffect(() => {
    if (!unread || done.current === conversationId) return;
    done.current = conversationId;
    void markReadAction(site, conversationId);
  }, [site, conversationId, unread]);
  return null;
}
