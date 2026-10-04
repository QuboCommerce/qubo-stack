"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

export type ChatLabels = {
  launcher: string;
  title: string;
  greeting: string;
  placeholder: string;
  send: string;
  name: string;
  email: string;
  contactHint: string;
  error: string;
  close: string;
};

type Author = "customer" | "staff" | "ai" | "system";
type Msg = { id: string; author: Author; name: string | null; body: string; createdAt: string; pending?: boolean };
type Thread = { conversationId: string | null; contact: { name: string | null; email: string | null }; messages: Msg[] };

const flagKey = (siteId: string) => `qubo-chat:${siteId}`;
const seenKey = (siteId: string) => `qubo-chat-seen:${siteId}`;
const store = {
  get: (k: string) => {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      window.localStorage.setItem(k, v);
    } catch {}
  },
};

const sample: Msg[] = [
  { id: "a", author: "customer", name: null, body: "Hi! Is this still in stock?", createdAt: "2026-01-01T10:00:00.000Z" },
  { id: "b", author: "staff", name: "Sam", body: "Yes, we have two left. Want me to reserve one?", createdAt: "2026-01-01T10:01:00.000Z" },
];

/**
 * Floating live chat. Talks to the storefront's same-origin `/api/chat`, which
 * keeps the visitor's token in an httpOnly cookie. Nothing loads until the
 * visitor opens the chat, unless they already have one (then replies show as a badge).
 */
export function ChatWidget({
  siteId,
  labels,
  position,
  askContact,
  preview,
}: {
  siteId: string;
  labels: ChatLabels;
  position: "right" | "left";
  askContact: "optional" | "required" | "off";
  /** Editor: render open with sample messages and never touch the network. */
  preview?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(preview));
  const [thread, setThread] = useState<Thread | null>(preview ? { conversationId: "preview", contact: { name: null, email: null }, messages: sample } : null);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const openRef = useRef(open);
  // Mirrors `thread` for the stream handler, which must not side-effect inside a state updater.
  const threadRef = useRef(thread);
  useEffect(() => {
    threadRef.current = thread;
  }, [thread]);
  const list = useRef<HTMLOListElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const stream = useRef<EventSource | null>(null);

  const markSeen = useCallback(
    (messages: Msg[]) => {
      const last = [...messages].reverse().find((m) => !m.pending);
      if (last) store.set(seenKey(siteId), last.createdAt);
      setUnread(0);
    },
    [siteId],
  );

  const countUnread = useCallback(
    (messages: Msg[]) => {
      const seen = store.get(seenKey(siteId)) ?? "";
      return messages.filter((m) => m.author !== "customer" && m.createdAt > seen).length;
    },
    [siteId],
  );

  const connect = useCallback(() => {
    if (stream.current || preview) return;
    const es = new EventSource("/api/chat/stream");
    stream.current = es;
    es.addEventListener("message", (ev) => {
      const m = JSON.parse((ev as MessageEvent<string>).data) as Msg;
      const t = threadRef.current;
      if (!t || t.messages.some((x) => x.id === m.id)) return;
      const temp = m.author === "customer" ? t.messages.findIndex((x) => x.pending && x.body === m.body) : -1;
      const messages = temp >= 0 ? t.messages.map((x, i) => (i === temp ? m : x)) : [...t.messages, m];
      threadRef.current = { ...t, messages };
      setThread(threadRef.current);
      if (openRef.current) markSeen(messages);
      else if (m.author !== "customer") setUnread((n) => n + 1);
    });
  }, [markSeen, preview]);

  const load = useCallback(async () => {
    const res = await fetch("/api/chat", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return setThread({ conversationId: null, contact: { name: null, email: null }, messages: [] });
    const data = (await res.json()) as Thread;
    setThread(data);
    if (data.conversationId) {
      store.set(flagKey(siteId), "1");
      if (openRef.current) markSeen(data.messages);
      else setUnread(countUnread(data.messages));
      connect();
    }
  }, [connect, countUnread, markSeen, siteId]);

  // Returning visitors with a chat: load it quietly so staff replies show as a badge.
  useEffect(() => {
    if (preview || store.get(flagKey(siteId)) !== "1") return;
    void load();
    return () => {
      stream.current?.close();
      stream.current = null;
    };
  }, [load, preview, siteId]);

  useEffect(() => {
    openRef.current = open;
    if (!open || preview) return;
    if (!thread) void load();
    else markSeen(thread.messages);
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [thread?.messages.length, open]);

  const needsContact = askContact !== "off" && !thread?.conversationId && !thread?.contact.email;

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (preview || busy) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    const body = String(data.get("body") ?? "").trim();
    if (!body) return;
    setBusy(true);
    setError(false);
    const temp: Msg = { id: `tmp-${Date.now()}`, author: "customer", name: null, body, createdAt: new Date().toISOString(), pending: true };
    setThread((t) => ({ ...(t ?? { conversationId: null, contact: { name: null, email: null } }), messages: [...(t?.messages ?? []), temp] }));
    (form.elements.namedItem("body") as HTMLTextAreaElement).value = "";
    const res = await fetch("/api/chat/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        body,
        name: data.get("name") || undefined,
        email: data.get("email") || undefined,
        pagePath: `${window.location.pathname}${window.location.search}`.slice(0, 500),
      }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError(true);
      setThread((t) => t && { ...t, messages: t.messages.filter((m) => m.id !== temp.id) });
      (form.elements.namedItem("body") as HTMLTextAreaElement).value = body;
      return;
    }
    const result = (await res.json()) as { conversationId: string; created: boolean; message: Msg };
    setThread((t) => {
      const base = t ?? { conversationId: null, contact: { name: null, email: null }, messages: [] };
      const known = base.messages.some((m) => m.id === result.message.id);
      const messages = known ? base.messages.filter((m) => m.id !== temp.id) : base.messages.map((m) => (m.id === temp.id ? result.message : m));
      const email = String(data.get("email") ?? "") || base.contact.email;
      return { ...base, conversationId: result.conversationId, contact: { name: base.contact.name, email }, messages };
    });
    store.set(flagKey(siteId), "1");
    if (result.created) connect();
  }

  return (
    <div className="qb-chat" data-position={position} data-preview={preview || undefined}>
      {open && (
        <div className="qb-chat-panel" role="dialog" aria-label={labels.title}>
          <header className="qb-chat-head">
            <strong>{labels.title}</strong>
            <button type="button" className="qb-chat-close" aria-label={labels.close} onClick={() => setOpen(false)}>
              ×
            </button>
          </header>
          <ol className="qb-chat-list" ref={list} aria-live="polite">
            {labels.greeting && (
              <li className="qb-chat-msg" data-author="staff">
                <p>{labels.greeting}</p>
              </li>
            )}
            {thread?.messages.map((m) => (
              <li key={m.id} className="qb-chat-msg" data-author={m.author === "customer" ? "customer" : "staff"} data-pending={m.pending || undefined}>
                {m.author !== "customer" && m.name && <span className="qb-chat-name">{m.name}</span>}
                <p>{m.body}</p>
              </li>
            ))}
          </ol>
          <form className="qb-chat-form" onSubmit={send}>
            {needsContact && (
              <div className="qb-chat-contact">
                <p>{labels.contactHint}</p>
                <input className="qb-input" name="name" autoComplete="name" placeholder={labels.name} maxLength={120} />
                <input className="qb-input" name="email" type="email" autoComplete="email" placeholder={labels.email} required={askContact === "required"} maxLength={320} />
              </div>
            )}
            {error && (
              <p className="qb-form-error" role="alert">
                {labels.error}
              </p>
            )}
            <div className="qb-chat-compose">
              <textarea
                ref={input}
                className="qb-input"
                name="body"
                rows={2}
                required
                maxLength={4000}
                placeholder={labels.placeholder}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <button type="submit" className="qb-button" data-emphasis="primary" data-size="sm" disabled={busy}>
                {labels.send}
              </button>
            </div>
          </form>
        </div>
      )}
      <button type="button" className="qb-chat-launcher" aria-expanded={open} aria-label={labels.launcher} onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {open ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />}
        </svg>
        <span className="qb-chat-launcher-label">{labels.launcher}</span>
        {unread > 0 && !open && <span className="qb-chat-badge">{unread}</span>}
      </button>
    </div>
  );
}
