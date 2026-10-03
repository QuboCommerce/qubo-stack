"use client";
import { usePathname, useRouter } from "next/navigation";
import { useRef } from "react";
import { EventsProvider, PresenceProvider, useEvent } from "@qubo/realtime/client";
import { FieldPresenceOverlay } from "@/components/presence";

/**
 * One event connection per tab, plus this tab's presence on `siteId`.
 * A replay gap ("reset") refreshes server data.
 */
export function LiveEvents({ siteId, userId, children }: { siteId: string; userId: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <EventsProvider url="/api/events" onReset={() => router.refresh()}>
      <PresenceProvider url="/api/presence" siteId={siteId} userId={userId} route={pathname}>
        {children}
        <FieldPresenceOverlay />
      </PresenceProvider>
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
