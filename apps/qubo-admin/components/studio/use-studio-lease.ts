"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import fjp, { type Operation } from "fast-json-patch";
import type { LeaseHolder } from "@qubo/realtime";
import { useEvent, usePresence } from "@qubo/realtime/client";

const RENEW = 10_000;
const STATUS = 15_000;
const PUSH_DELAY = 200;

export type LeaseRole = "loading" | "editor" | "follower";

/**
 * This tab's lease on a Studio document. The first tab to open a document
 * edits; others follow. Followers can request control; the holder decides,
 * unless it has been idle for a minute or is gone (then it is granted).
 */
export function useStudioLease({ siteId, documentId, onLost }: { siteId: string; documentId: string; onLost?: () => void }) {
  const { clientId, userId } = usePresence();
  const resource = `doc:${documentId}`;
  const [holder, setHolder] = useState<LeaseHolder | null | undefined>(undefined);
  const [requests, setRequests] = useState<LeaseHolder[]>([]);
  const [requested, setRequested] = useState(false);
  const active = useRef(false);
  const role: LeaseRole = holder === undefined || !clientId ? "loading" : holder?.clientId === clientId ? "editor" : "follower";
  const roleRef = useRef(role);
  const onLostRef = useRef(onLost);
  onLostRef.current = onLost;

  const update = useCallback(
    (next: LeaseHolder | null) => {
      setHolder((prev) => {
        if (prev?.clientId === clientId && next?.clientId !== clientId) queueMicrotask(() => onLostRef.current?.());
        return next;
      });
      if (next?.clientId === clientId) setRequested(false);
      else setRequests([]);
    },
    [clientId],
  );

  const call = useCallback(
    async (op: string, extra: Record<string, unknown> = {}) => {
      const r = await fetch("/api/studio/lease", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op, siteId, documentId, clientId, ...extra }),
      });
      if (!r.ok) throw new Error(`lease ${op}: ${r.status}`);
      const res = (await r.json()) as { holder: LeaseHolder | null; granted?: boolean };
      update(res.holder);
      return res;
    },
    [siteId, documentId, clientId, update],
  );

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  // Open: try to take it.
  useEffect(() => {
    if (!clientId) return;
    void call("acquire").catch(() => update(null));
  }, [clientId, call, update]);

  // Freed (holder left or expired): whoever is still here takes over.
  const free = holder === null && !!clientId;
  useEffect(() => {
    if (free) void call("acquire").catch(() => {});
  }, [free, call]);

  // Holder heartbeat; followers re-check (expiry emits no event). A follower who asked keeps asking.
  useEffect(() => {
    if (role === "loading") return;
    const t = setInterval(
      () => {
        if (role === "editor") {
          const was = active.current;
          active.current = false;
          void call("renew", { active: was }).catch(() => {});
        } else void call(requested ? "request" : "renew").catch(() => {});
      },
      role === "editor" ? RENEW : requested ? RENEW : STATUS,
    );
    return () => clearInterval(t);
  }, [role, requested, call]);

  // Leaving releases at once so the next person doesn't wait for expiry.
  useEffect(() => {
    if (!clientId) return;
    const leave = () => {
      if (roleRef.current !== "editor") return;
      navigator.sendBeacon?.("/api/studio/lease", new Blob([JSON.stringify({ op: "release", siteId, documentId, clientId })], { type: "application/json" }));
    };
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, [siteId, documentId, clientId]);

  useEvent("studio.lease.changed", (e) => {
    if (e.siteId === siteId && e.payload.resource === resource) update(e.payload.holder);
  });
  useEvent("studio.lease.requested", (e) => {
    if (e.siteId !== siteId || e.payload.resource !== resource || roleRef.current !== "editor") return;
    const from = e.payload.from;
    if (from.clientId === clientId) return;
    setRequests((rs) => [...rs.filter((r) => r.clientId !== from.clientId), from]);
  });

  return {
    role,
    holder: holder ?? null,
    clientId,
    self: userId,
    requests,
    requested,
    /** Ask for control (granted at once when free, idle or ours). */
    request: useCallback(async () => {
      setRequested(true);
      const res = await call("request");
      if (res.granted) setRequested(false);
      return res;
    }, [call]),
    grant: useCallback((to: LeaseHolder) => call("grant", { to }), [call]),
    dismiss: useCallback((to: LeaseHolder) => setRequests((rs) => rs.filter((r) => r.clientId !== to.clientId)), []),
    /** Call on local edits so idle detection knows the holder is working. */
    markActive: useCallback(() => {
      active.current = true;
    }, []),
  };
}

export type StudioLease = ReturnType<typeof useStudioLease>;

const clone = <T,>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

/**
 * Live canvas between the holder and followers. The holder `push`es every
 * settled state (diffed into JSON Patch, batched); followers get `onRemote`
 * with the holder's canvas as it changes.
 */
export function useLiveCanvas({
  siteId,
  documentId,
  role,
  clientId,
  onRemote,
}: {
  siteId: string;
  documentId: string;
  role: LeaseRole;
  clientId: string;
  onRemote: (data: unknown) => void;
}) {
  const state = useRef<{ epoch: string | null; seq: number; data: unknown }>({ epoch: null, seq: 0, data: undefined });
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const latest = useRef<unknown>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRemoteRef = useRef(onRemote);
  onRemoteRef.current = onRemote;
  const roleRef = useRef(role);
  roleRef.current = role;

  const post = useCallback(
    async (body: Record<string, unknown>) => {
      const r = await fetch("/api/studio/live", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ siteId, documentId, clientId, ...body }),
      });
      return { status: r.status, body: (await r.json().catch(() => ({}))) as { epoch?: string; seq?: number } };
    },
    [siteId, documentId, clientId],
  );

  const sendSnapshot = useCallback(
    async (data: unknown) => {
      const res = await post({ snapshot: data });
      if (res.status === 200 && res.body.epoch) state.current = { epoch: res.body.epoch, seq: 0, data: clone(data) };
      else state.current = { epoch: null, seq: 0, data: undefined };
    },
    [post],
  );

  const flushPush = useCallback(() => {
    queue.current = queue.current.then(async () => {
      if (roleRef.current !== "editor") return;
      const data = latest.current;
      const s = state.current;
      if (!s.epoch) return sendSnapshot(data);
      const ops = fjp.compare(s.data as object, data as object);
      if (!ops.length) return;
      const res = await post({ epoch: s.epoch, seq: s.seq + 1, ops });
      if (res.status === 200) state.current = { epoch: s.epoch, seq: s.seq + 1, data: clone(data) };
      else if (res.status === 409) await sendSnapshot(data);
    }).catch(() => {});
  }, [post, sendSnapshot]);

  /** Holder: the canvas changed. */
  const push = useCallback(
    (data: unknown) => {
      latest.current = data;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flushPush, PUSH_DELAY);
    },
    [flushPush],
  );

  /** Holder just started editing: publish a fresh snapshot. */
  const start = useCallback(
    (data: unknown) => {
      latest.current = data;
      state.current = { epoch: null, seq: 0, data: undefined };
      flushPush();
    },
    [flushPush],
  );

  const fetchLive = useCallback(async () => {
    const r = await fetch(`/api/studio/live?siteId=${encodeURIComponent(siteId)}&documentId=${encodeURIComponent(documentId)}`);
    if (!r.ok) return;
    const { live } = (await r.json()) as { live: { epoch: string; seq: number; data: unknown } | null };
    if (!live || roleRef.current !== "follower") return;
    state.current = { epoch: live.epoch, seq: live.seq, data: live.data };
    onRemoteRef.current(clone(live.data));
  }, [siteId, documentId]);

  useEffect(() => {
    if (role === "follower") void fetchLive();
    else state.current = { epoch: null, seq: 0, data: undefined };
  }, [role, fetchLive]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useEvent("document.patched", (e) => {
    if (e.siteId !== siteId || e.payload.documentId !== documentId || roleRef.current !== "follower") return;
    const s = state.current;
    const { epoch, seq, ops } = e.payload;
    if (s.epoch === epoch && seq === s.seq + 1 && s.data !== undefined) {
      try {
        const next = fjp.applyPatch(clone(s.data), ops as Operation[], false, true).newDocument;
        state.current = { epoch, seq, data: next };
        onRemoteRef.current(clone(next));
        return;
      } catch {}
    }
    if (s.epoch === epoch && seq <= s.seq) return;
    void fetchLive();
  });

  return { push, start };
}
