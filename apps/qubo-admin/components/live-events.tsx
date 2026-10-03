"use client";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useRef, useState } from "react";
import { EventsProvider, PresenceProvider, useEvent } from "@qubo/realtime/client";
import { FieldPresenceOverlay } from "@/components/presence";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const ViewerContext = createContext<{ userId: string } | null>(null);
/** The signed-in user inside `LiveEvents`. */
export const useViewer = () => useContext(ViewerContext);

/**
 * One event connection per tab, plus this tab's presence on `siteId`.
 * A replay gap ("reset") refreshes server data.
 */
export function LiveEvents({ siteId, userId, sessionId, children }: { siteId: string; userId: string; sessionId: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <ViewerContext.Provider value={{ userId }}>
    <EventsProvider url="/api/events" onReset={() => router.refresh()}>
      <PresenceProvider url="/api/presence" siteId={siteId} userId={userId} route={pathname}>
        {children}
        <FieldPresenceOverlay />
        <SessionEnded sessionId={sessionId} />
      </PresenceProvider>
    </EventsProvider>
    </ViewerContext.Provider>
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

type Ended = { reason: "takeover" | "revoked"; deviceLabel: string | null; city: string | null };

/** Blocking modal when this tab's session is ended from another device. */
function SessionEnded({ sessionId }: { sessionId: string }) {
  const [ended, setEnded] = useState<Ended | null>(null);
  useEvent("session.revoked", (e) => {
    if (e.payload.sessionId === sessionId) setEnded({ reason: e.payload.reason, ...e.payload.by });
  });
  if (!ended) return null;
  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent showCloseButton={false} onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{ended.reason === "takeover" ? "You have been logged in elsewhere" : "This device was signed out"}</DialogTitle>
          <DialogDescription>{[ended.deviceLabel, ended.city, "just now"].filter(Boolean).join(" · ")}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Unsaved changes in this tab can no longer be saved. Sign in again to continue.</p>
        <DialogFooter>
          <a href="/sign-in" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Sign in again</a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
