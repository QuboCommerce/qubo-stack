import { Elysia, t } from "elysia";
import { createRateLimiter, LIMITS } from "@qubo/inbox";
import { chatMessage, chatSeen, chatSend, chatThread, findChat, type ChatVisitor } from "@qubo/inbox/server";
import { getHub } from "@qubo/realtime/server";
import { verifiedClientIp } from "@qubo/shared/client-ip";
import { tenancy } from "../plugins/tenancy";

/** Set by the storefront from its httpOnly `qb_chat` cookie. */
export const CHAT_TOKEN_HEADER = "x-qubo-chat-token";
const TOKEN = /^[A-Za-z0-9_-]{32,64}$/;
const HEARTBEAT_MS = 25_000;

const perVisitor = createRateLimiter(LIMITS.chatPerWindow);
const perSite = createRateLimiter(LIMITS.chatPerSiteWindow);

const clientIp = (headers: Record<string, string | undefined>) =>
  verifiedClientIp((n) => headers[n]) || headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown";

type Session = { user: { id: string; name: string | null; email: string } } | null;

function visitorOf(headers: Record<string, string | undefined>, session: Session): ChatVisitor {
  const token = headers[CHAT_TOKEN_HEADER]?.trim();
  return {
    token: token && TOKEN.test(token) ? token : null,
    user: session ? { id: session.user.id, name: session.user.name, email: session.user.email.toLowerCase() } : null,
  };
}

const enc = new TextEncoder();
const frame = (event: string, data: unknown) => enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

/**
 * Storefront chat. The visitor is their session (signed-in customers) or an
 * anonymous cookie token; neither can reach another visitor's conversation.
 * Only public messages are ever returned; internal notes stay in the admin.
 */
export const chat = new Elysia({ prefix: "/chat" })
  .use(tenancy)
  .get("/", async ({ site, session, headers, status }) => {
    if (!site) return status(400, { error: "site_not_resolved" });
    if (!site.capabilities.includes("leads")) return status(404, { error: "not_found" });
    return chatThread(site.id, visitorOf(headers, session));
  })
  .post(
    "/messages",
    async ({ site, session, headers, body, status }) => {
      if (!site) return status(400, { error: "site_not_resolved" });
      if (!site.capabilities.includes("leads")) return status(404, { error: "not_found" });
      if (!perVisitor(`${site.id}:${clientIp(headers)}`) || !perSite(site.id)) return status(429, { error: "rate_limited" });
      const result = await chatSend(site.id, visitorOf(headers, session), body);
      if (!result.ok) return status(result.error === "no_identity" ? 401 : 422, { error: result.error });
      return result;
    },
    {
      body: t.Object({
        body: t.String({ maxLength: LIMITS.chatMessageLength + 100 }),
        name: t.Optional(t.String({ maxLength: 200 })),
        email: t.Optional(t.String({ maxLength: 320 })),
        pagePath: t.Optional(t.String({ maxLength: 512 })),
      }),
    },
  )
  /** SSE of new public messages in the visitor's chat. Keeps `visitor_seen_at` fresh while open. */
  .get("/stream", async ({ site, session, headers, request, status }) => {
    if (!site) return status(400, { error: "site_not_resolved" });
    if (!site.capabilities.includes("leads")) return status(404, { error: "not_found" });
    const conv = await findChat(site.id, visitorOf(headers, session));
    if (!conv) return status(404, { error: "no_chat" });

    const hub = getHub();
    await hub.ready;
    let cleanup = () => {};
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (chunk: Uint8Array) => {
          try {
            controller.enqueue(chunk);
          } catch {
            cleanup();
          }
        };
        const unsubscribe = hub.subscribe({ userId: "", siteIds: new Set([site.id]), orgIds: new Set() }, async (e) => {
          if (e.type === "conversation.message" && e.payload.conversationId === conv.id) {
            const m = await chatMessage(conv.id, e.payload.messageId);
            if (m) send(frame("message", m));
          } else if (e.type === "conversation.updated" && e.payload.conversationId === conv.id) {
            send(frame("updated", {}));
          }
        });
        const beat = setInterval(() => {
          send(enc.encode(`: ping\n\n`));
          void chatSeen(conv.id).catch(() => {});
        }, HEARTBEAT_MS);
        cleanup = () => {
          clearInterval(beat);
          unsubscribe();
        };
        request.signal.addEventListener("abort", () => {
          cleanup();
          void chatSeen(conv.id).catch(() => {});
          try {
            controller.close();
          } catch {}
        });
        send(enc.encode(`retry: 3000\n\n`));
        send(frame("ready", { conversationId: conv.id }));
        void chatSeen(conv.id).catch(() => {});
      },
      cancel() {
        cleanup();
      },
    });
    return new Response(stream, {
      headers: { "content-type": "text/event-stream", "cache-control": "no-store, no-transform", "x-accel-buffering": "no", connection: "keep-alive" },
    });
  });
