"use client";
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { PresenceEntry } from "./index";
import { useEvent } from "./client";

type Location = { documentId?: string; blockId?: string; fieldPath?: string };
type Ctx = {
  clientId: string;
  userId: string;
  entries: PresenceEntry[];
  report: (owner: symbol, loc: Location | null) => void;
};
const PresenceContext = createContext<Ctx | null>(null);

const HEARTBEAT_VISIBLE = 30_000;
const HEARTBEAT_HIDDEN = 60_000;
const DEBOUNCE = 2_000;

/** A form control's presence key: its `name` (what server actions read). */
function fieldOf(el: EventTarget | null): string | undefined {
  if (!(el instanceof HTMLElement)) return undefined;
  const named = el.closest<HTMLElement>("[data-presence-field]")?.dataset.presenceField ?? (el as HTMLInputElement).name;
  return named && el.closest("form") ? named : undefined;
}

/**
 * Reports where this tab is (`route` + whatever children add with
 * `useReportPresence`) and keeps the site's presence list in sync. Needs an
 * `EventsProvider` above it. The focused form field is tracked automatically.
 */
export function PresenceProvider({ url, siteId, userId, route, children }: { url: string; siteId: string; userId: string; route: string; children: ReactNode }) {
  const clientId = useMemo(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)), []);
  const [entries, setEntries] = useState<PresenceEntry[]>([]);
  const [field, setField] = useState<string | undefined>();
  const [reports, setReports] = useState<Map<symbol, Location>>(() => new Map());
  const [focused, setFocused] = useState(true);

  const location = useMemo(() => {
    const merged: Location = {};
    for (const loc of reports.values()) Object.assign(merged, Object.fromEntries(Object.entries(loc).filter(([, v]) => v !== undefined)));
    return { ...merged, fieldPath: merged.fieldPath ?? field };
  }, [reports, field]);

  const body = useRef("");
  body.current = JSON.stringify({ clientId, siteId, route, focused, ...location });

  const send = useCallback(async () => {
    try {
      const r = await fetch(url, { method: "POST", body: body.current, credentials: "include", headers: { "content-type": "application/json" }, keepalive: true });
      if (r.ok) setEntries(((await r.json()) as { entries: PresenceEntry[] }).entries);
    } catch {}
  }, [url]);

  // Debounced send on change (first one immediately).
  const first = useRef(true);
  const payload = body.current;
  useEffect(() => {
    if (first.current) { first.current = false; void send(); return; }
    const t = setTimeout(send, DEBOUNCE);
    return () => clearTimeout(t);
  }, [payload, send]);

  // Heartbeat; slower when hidden.
  useEffect(() => {
    const t = setInterval(send, focused ? HEARTBEAT_VISIBLE : HEARTBEAT_HIDDEN);
    return () => clearInterval(t);
  }, [focused, send]);

  useEffect(() => {
    const update = () => setFocused(document.visibilityState === "visible" && document.hasFocus());
    const onFocusIn = (e: FocusEvent) => setField(fieldOf(e.target));
    const onFocusOut = (e: FocusEvent) => { if (!fieldOf(e.relatedTarget)) setField(undefined); };
    const leave = () => navigator.sendBeacon?.(url, new Blob([JSON.stringify({ clientId, siteId, leave: true })], { type: "application/json" }));
    update();
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    window.addEventListener("blur", update);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    window.addEventListener("pagehide", leave);
    return () => {
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
      window.removeEventListener("blur", update);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("pagehide", leave);
    };
  }, [url, clientId, siteId]);

  useEvent("presence.changed", (e) => { if (e.siteId === siteId) setEntries(e.payload.entries); });

  const report = useCallback((owner: symbol, loc: Location | null) => {
    setReports((prev) => {
      const next = new Map(prev);
      if (loc) next.set(owner, loc);
      else next.delete(owner);
      return next;
    });
  }, []);

  const value = useMemo<Ctx>(() => ({ clientId, userId, entries, report }), [clientId, userId, entries, report]);
  return createElement(PresenceContext.Provider, { value }, children);
}

/** Adds detail to this tab's presence (document, selected block, field) while mounted. */
export function useReportPresence(loc: Location) {
  const ctx = useContext(PresenceContext);
  const owner = useMemo(() => Symbol("presence"), []);
  const { documentId, blockId, fieldPath } = loc;
  const report = ctx?.report;
  useEffect(() => {
    report?.(owner, { documentId, blockId, fieldPath });
  }, [report, owner, documentId, blockId, fieldPath]);
  useEffect(() => () => report?.(owner, null), [report, owner]);
}

/** Raw presence list for the site, including this tab. */
export function usePresence() {
  const ctx = useContext(PresenceContext);
  return { entries: ctx?.entries ?? [], clientId: ctx?.clientId ?? "", userId: ctx?.userId ?? "" };
}

export type Peer = PresenceEntry & { tabs: number };

/**
 * Other users on this site (one per user: their most recently active, focused-first
 * tab), optionally filtered by where they are.
 */
export function usePeers(filter?: (e: PresenceEntry) => boolean): Peer[] {
  const { entries, userId } = usePresence();
  const byUser = new Map<string, Peer>();
  for (const e of entries) {
    if (e.userId === userId || (filter && !filter(e))) continue;
    const prev = byUser.get(e.userId);
    const better = !prev || (e.focused && !prev.focused) || (e.focused === prev.focused && e.at > prev.at);
    byUser.set(e.userId, better ? { ...e, tabs: (prev?.tabs ?? 0) + 1 } : { ...prev, tabs: prev.tabs + 1 });
  }
  return [...byUser.values()].sort((a, b) => a.name.localeCompare(b.name));
}
