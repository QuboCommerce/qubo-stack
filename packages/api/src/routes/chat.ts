import { Elysia, t } from "elysia";
import { createRateLimiter, LIMITS } from "@qubo/inbox";
import { chatFile, chatMessage, chatSeen, chatSend, chatThread, findChat, serveInboxFile, type ChatVisitor, type IncomingFile } from "@qubo/inbox/server";
import { CHAT_ATTACHMENTS, UPLOAD_PROFILES } from "@qubo/storage";
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

/** Text fields plus files of a multipart send; JSON sends carry no files. */
async function readSend(request: Request): Promise<{ fields: Record<string, string>; files: IncomingFile[] } | { error: string }> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.startsWith("multipart/form-data")) {
    const json = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!json || typeof json !== "object") return { error: "invalid_body" };
    const fields = Object.fromEntries(Object.entries(json).filter((e): e is [string, string] => typeof e[1] === "string"));
    return { fields, files: [] };
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_SEND_BYTES) return { error: "too_large" };
  const form = await request.formData().catch(() => null);
  if (!form) return { error: "invalid_body" };
  const fields: Record<string, string> = {};
  const files: IncomingFile[] = [];
  for (const [k, v] of form.entries()) {
    if (typeof v === "string") fields[k] = v;
    else if (k === "files") {
      const file = v as unknown as File;
      if (file.size) files.push({ filename: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
    }
  }
  return { fields, files };
}
const MAX_SEND_BYTES = CHAT_ATTACHMENTS.perMessage * Math.max(...Object.values(UPLOAD_PROFILES.chat.maxBytes)) + 64_000;

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
  /** JSON `{ body, name?, email?, pagePath? }`, or the same as multipart with up to 3 `files`. */
  .post(
    "/messages",
    async ({ site, session, headers, request, status }) => {
      if (!site) return status(400, { error: "site_not_resolved" });
      if (!site.capabilities.includes("leads")) return status(404, { error: "not_found" });
      if (!perVisitor(`${site.id}:${clientIp(headers)}`) || !perSite(site.id)) return status(429, { error: "rate_limited" });
      const input = await readSend(request);
      if ("error" in input) return status(input.error === "too_large" ? 413 : 400, { error: input.error });
      const f = input.fields;
      const body = f.body ?? "";
      if (body.length > LIMITS.chatMessageLength + 100 || (f.name?.length ?? 0) > 200 || (f.email?.length ?? 0) > 320) return status(422, { error: "too_long" });
      const result = await chatSend(site.id, visitorOf(headers, session), {
        body,
        name: f.name,
        email: f.email,
        pagePath: f.pagePath?.slice(0, 512),
        files: input.files,
      });
      if (!result.ok) {
        const code = result.error === "no_identity" ? 401 : result.error === "storage_unavailable" ? 503 : 422;
        return status(code, result.error === "bad_file" ? { error: result.error, message: result.message } : { error: result.error });
      }
      return result;
    },
    { parse: "none" },
  )
  /** A file from the visitor's own chat (never from internal notes). */
  .get(
    "/files/:id",
    async ({ site, session, headers, params, query, status }) => {
      if (!site) return status(400, { error: "site_not_resolved" });
      if (!site.capabilities.includes("leads")) return status(404, { error: "not_found" });
      const conv = await findChat(site.id, visitorOf(headers, session));
      const row = conv ? await chatFile(conv.id, params.id) : null;
      if (!row) return status(404, { error: "not_found" });
      return serveInboxFile(row, { download: query.download === "1" });
    },
    { params: t.Object({ id: t.String({ format: "uuid" }) }), query: t.Object({ download: t.Optional(t.String()) }) },
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
