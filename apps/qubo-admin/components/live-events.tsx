"use client";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { EventsProvider, useEvent } from "@qubo/realtime/client";

/** One event connection per tab. A replay gap ("reset") refreshes server data. */
export function LiveEvents({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <EventsProvider url="/api/events" onReset={() => router.refresh()}>
      {children}
    </EventsProvider>
  );
}

/**
 * Refreshes the current server-rendered page when someone else changes one of
 * `tables` on this site. Use on read-only views (lists, dashboards), not forms.
 */
export function LiveRefresh({ siteId, userId, tables }: { siteId: string; userId: string; tables: string[] }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEvent("entity.updated", (e) => {
    if (e.siteId !== siteId || e.payload.by.id === userId || !tables.includes(e.payload.table)) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), 400);
  });
  return null;
}
