"use client";
import { createContext, createElement, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { EVENT_TYPES, type DeliveredEvent, type EventOf, type EventType } from "./index";

export type ConnectionState = "connecting" | "live" | "polling" | "offline";
type Handler = (e: DeliveredEvent) => void;

/**
 * Browser connection: EventSource with resume; after two failed opens it falls
 * back to polling `${url}/poll` every 30 s and retries SSE every 5 min.
 * `onReset` fires when the server can't replay (too far behind): reload data.
 */
export function connectEvents(url: string, opts: { onEvent: Handler; onReset?: () => void; onState?: (s: ConnectionState) => void }) {
  let es: EventSource | null = null;
  let cursor: string | null = null;
  let failures = 0;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  const seen = (id: string) => cursor !== null && BigInt(id) <= BigInt(cursor);
  const deliver = (e: DeliveredEvent) => { if (seen(e.id)) return; cursor = e.id; opts.onEvent(e); };

  function openSse() {
    if (closed) return;
    opts.onState?.("connecting");
    es = new EventSource(cursor ? `${url}?since=${cursor}` : url, { withCredentials: true });
    es.onopen = () => { failures = 0; stopPolling(); opts.onState?.("live"); };
    es.addEventListener("ready", (m) => { cursor = (m as MessageEvent).lastEventId || cursor; });
    es.addEventListener("reset", () => opts.onReset?.());
    es.onerror = () => {
      if (es?.readyState === EventSource.CLOSED || ++failures >= 2) { es?.close(); es = null; startPolling(); }
      else opts.onState?.("connecting");
    };
    for (const type of EVENT_TYPES) es.addEventListener(type, (m) => { try { deliver(JSON.parse((m as MessageEvent).data)); } catch {} });
  }

  function startPolling() {
    if (closed || pollTimer) return;
    opts.onState?.("polling");
    const tick = async () => {
      try {
        const r = await fetch(`${url}/poll${cursor ? `?since=${cursor}` : ""}`, { credentials: "include", cache: "no-store" });
        if (!r.ok) return opts.onState?.("offline");
        const body = (await r.json()) as { events: DeliveredEvent[]; cursor: string; reset: boolean };
        if (body.reset) opts.onReset?.();
        body.events.forEach(deliver);
        cursor = body.cursor;
        opts.onState?.("polling");
      } catch { opts.onState?.("offline"); }
    };
    void tick();
    pollTimer = setInterval(tick, 30_000);
    retryTimer = setTimeout(() => { stopPolling(); openSse(); }, 5 * 60_000);
  }
  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    if (retryTimer) clearTimeout(retryTimer);
    pollTimer = retryTimer = null;
  }

  openSse();
  return () => { closed = true; es?.close(); stopPolling(); };
}

type Ctx = { subscribe: (h: Handler) => () => void; state: ConnectionState };
const EventsContext = createContext<Ctx | null>(null);

/** One connection per tab; children subscribe with `useEvent`. */
export function EventsProvider({ url, onReset, children }: { url: string; onReset?: () => void; children: ReactNode }) {
  const handlers = useRef(new Set<Handler>());
  const resetRef = useRef(onReset);
  resetRef.current = onReset;
  const [state, setState] = useState<ConnectionState>("connecting");
  useEffect(
    () => connectEvents(url, { onEvent: (e) => handlers.current.forEach((h) => h(e)), onReset: () => resetRef.current?.(), onState: setState }),
    [url],
  );
  const value = useRef<Ctx>({ subscribe: (h) => (handlers.current.add(h), () => handlers.current.delete(h)), state });
  value.current = { ...value.current, state };
  return createElement(EventsContext.Provider, { value: value.current }, children);
}

export function useEvent<T extends EventType>(type: T | T[], handler: (e: EventOf<T> & { id: string; createdAt: string }) => void) {
  const ctx = useContext(EventsContext);
  const ref = useRef(handler);
  ref.current = handler;
  const key = Array.isArray(type) ? type.join(",") : type;
  useEffect(() => {
    if (!ctx) return;
    const types = new Set(key.split(","));
    return ctx.subscribe((e) => { if (types.has(e.type)) ref.current(e as never); });
  }, [ctx, key]);
}

export const useConnectionState = () => useContext(EventsContext)?.state ?? "offline";
