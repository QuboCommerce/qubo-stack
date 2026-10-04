import { db, sql } from "@qubo/db/client";
import { conversation, form, formSubmission, inboxFile, message, site, type MessageAttachment } from "@qubo/db/schema";
import { publish } from "@qubo/realtime/server";
import { storageConfigured } from "@qubo/storage/server";
import { createHash } from "node:crypto";
import { and, count, desc, eq, gt, inArray, isNotNull, isNull, lte, ne } from "drizzle-orm";
import { baseSubject, CHAT_AWAY_MS, chatSubject, createRateLimiter, htmlToText, INBOUND_PER_HOUR, inboundRoute, isAutoReply, parseAddress, referencedIds, replyAddress, stripQuoted, cleanFormData, formNameFromKey, formThread, isEmail, isSignupOnly, LIMITS, publicStaffName, replySubject, textToHtml, type Channel, type Status } from "./index";

import { checkUploads, claimDraftFiles, linkFiles, readBytes, storeFiles, type IncomingFile } from "./files";
import { CHAT_ATTACHMENTS, cleanFilename } from "@qubo/storage";

export * from "./files";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Never fails the caller: events are a convenience, the rows are the truth. */
async function emit(event: Parameters<typeof publish>[1]) {
  try {
    await publish(sql, event);
  } catch (e) {
    console.error("[inbox] event publish failed", event.type, e);
  }
}

export type Opener = {
  siteId: string;
  channel: Channel;
  subject: string;
  body: string;
  contactName?: string | null;
  contactEmail?: string | null;
  customerId?: string | null;
  orderId?: string | null;
  formSubmissionId?: string | null;
  attachments?: MessageAttachment[];
};

/** New conversation with its first (customer) message. */
export async function openConversation(input: Opener, tx: Tx | typeof db = db) {
  const [conv] = await tx
    .insert(conversation)
    .values({
      siteId: input.siteId,
      channel: input.channel,
      subject: input.subject.slice(0, LIMITS.subjectLength),
      contactName: input.contactName ?? null,
      contactEmail: input.contactEmail ?? null,
      customerId: input.customerId ?? null,
      orderId: input.orderId ?? null,
      formSubmissionId: input.formSubmissionId ?? null,
    })
    .returning();
  const [msg] = await tx
    .insert(message)
    .values({
      conversationId: conv!.id,
      authorType: "customer",
      authorId: input.customerId ?? null,
      authorName: input.contactName ?? input.contactEmail ?? null,
      body: input.body,
      attachments: input.attachments ?? [],
    })
    .returning({ id: message.id });
  return { conversation: conv!, messageId: msg!.id };
}

export type SubmitResult =
  | { ok: true; kind: "conversation"; conversationId: string; submissionId: string }
  | { ok: true; kind: "submission" | "spam"; submissionId: string | null }
  | { ok: false; error: "too_many_forms" | "empty" };

/**
 * Public form post → `form_submission` (+ conversation unless it's a bare
 * sign-up). Unknown keys create the form on first use, capped per site, so a
 * builder can drop a form block anywhere without visiting settings first.
 */
export async function submitForm(input: {
  siteId: string;
  key: string;
  raw: Record<string, unknown>;
  spam: boolean;
  pagePath?: string | null;
  locale?: string | null;
}): Promise<SubmitResult> {
  const key = input.key.trim().toLowerCase().slice(0, LIMITS.keyLength) || "contact";
  const data = cleanFormData(input.raw);
  if (!Object.keys(data).length) return { ok: false, error: "empty" };

  const result = await db.transaction(async (tx) => {
    let f = await tx.query.form.findFirst({ where: and(eq(form.siteId, input.siteId), eq(form.key, key)) });
    if (!f) {
      const [{ value }] = (await tx.select({ value: count() }).from(form).where(eq(form.siteId, input.siteId))) as [{ value: number }];
      if (value >= LIMITS.formsPerSite) return { ok: false, error: "too_many_forms" } as const;
      [f] = await tx.insert(form).values({ siteId: input.siteId, key, name: formNameFromKey(key) }).onConflictDoNothing().returning();
      f ??= await tx.query.form.findFirst({ where: and(eq(form.siteId, input.siteId), eq(form.key, key)) });
    }
    const [sub] = await tx
      .insert(formSubmission)
      .values({ formId: f!.id, data, status: input.spam ? "spam" : "new", pagePath: input.pagePath ?? null, locale: input.locale ?? null })
      .returning({ id: formSubmission.id });
    if (input.spam) return { ok: true, kind: "spam", submissionId: sub!.id } as const;
    if (isSignupOnly(data)) return { ok: true, kind: "submission", submissionId: sub!.id, form: f! } as const;

    const thread = formThread(f!.name, data);
    const opened = await openConversation({ siteId: input.siteId, channel: "form", formSubmissionId: sub!.id, ...thread }, tx);
    await tx.update(formSubmission).set({ status: "read" }).where(eq(formSubmission.id, sub!.id));
    return { ok: true, kind: "conversation", conversationId: opened.conversation.id, submissionId: sub!.id, form: f!, thread } as const;
  });

  if (!result.ok || result.kind === "spam") return result;
  if (result.kind === "conversation") {
    await emit({ type: "conversation.created", siteId: input.siteId, payload: { conversationId: result.conversationId } });
    if (result.form.notifyEmails.length) void notifyForm(input.siteId, result.form.notifyEmails, result.thread).catch((e) => console.error("[inbox] notify failed", e));
    return { ok: true, kind: "conversation", conversationId: result.conversationId, submissionId: result.submissionId };
  }
  return { ok: true, kind: "submission", submissionId: result.submissionId };
}

// ------------------------------------------------------------------ e-mail ---

const fromAddress = () => process.env.EMAIL_FROM?.trim() || process.env.ORDER_EMAIL_FROM?.trim() || "";

/** `Name <addr@domain>` → `domain`, used for our own Message-IDs. */
const fromDomain = (from: string) => from.match(/@([^>\s]+)/)?.[1] ?? "qubo.local";

type Mail = {
  to: string[];
  subject: string;
  text: string;
  html: string;
  fromName?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  attachments?: { filename: string; content: string }[];
};

/** Resend; returns null when e-mail isn't configured on this instance. */
async function sendMail(mail: Mail): Promise<{ sent: true } | null> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = fromAddress();
  if (!apiKey || !from) return null;
  const sender = mail.fromName ? `${mail.fromName.replace(/[<>"]/g, "")} <${from.match(/<([^>]+)>/)?.[1] ?? from}>` : from;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from: sender, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html, reply_to: mail.replyTo, headers: mail.headers, attachments: mail.attachments }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return { sent: true };
}

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY?.trim() && fromAddress());

/** Domain Resend receives mail on for this instance (`<id>.resend.app` or a verified domain); empty = no inbound. */
export const inboundDomain = () => process.env.EMAIL_INBOUND_DOMAIN?.trim().toLowerCase() || "";

async function notifyForm(siteId: string, to: string[], thread: { subject: string; body: string; contactName: string | null; contactEmail: string | null }) {
  const s = await db.query.site.findFirst({ where: eq(site.id, siteId), columns: { name: true } });
  const who = [thread.contactName, thread.contactEmail].filter(Boolean).join(" · ") || "Anonymous";
  const text = `${who}\n\n${thread.body}`;
  await sendMail({
    to,
    subject: `[${s?.name ?? "Site"}] ${thread.subject}`,
    text,
    html: textToHtml(text),
    fromName: s?.name,
    replyTo: thread.contactEmail ?? undefined,
  });
}

// ----------------------------------------------------------- staff replies ---

export type ReplyResult = { messageId: string; delivered: boolean | null; error: string | null };

/**
 * Staff reply or internal note. Public replies on threads with a contact
 * e-mail go out through Resend, threaded on the previous e-mail; the message
 * is stored first so a delivery failure never loses the reply.
 */
export async function reply(input: {
  conversationId: string;
  siteId: string;
  author: { id: string; name: string };
  body: string;
  internal: boolean;
  /** Draft uploads (`uploadDraftFiles`) by this author to send with the reply. */
  fileIds?: string[];
}): Promise<ReplyResult> {
  const body = input.body.trim().slice(0, LIMITS.replyLength);
  const conv = await db.query.conversation.findFirst({ where: and(eq(conversation.id, input.conversationId), eq(conversation.siteId, input.siteId)) });
  if (!conv) throw new Error("conversation_not_found");

  const from = fromAddress();
  const [msg] = await db
    .insert(message)
    .values({ conversationId: conv.id, authorType: "staff", authorId: input.author.id, authorName: input.author.name, body, internal: input.internal })
    .returning({ id: message.id });
  const messageId = msg!.id;
  const attachments = await claimDraftFiles(conv.id, input.author.id, messageId, input.fileIds ?? []);
  await linkFiles(messageId, attachments);
  await db
    .update(conversation)
    .set({ lastMessageAt: new Date(), updatedAt: new Date(), unread: false, assigneeId: conv.assigneeId ?? input.author.id })
    .where(eq(conversation.id, conv.id));

  let delivered: boolean | null = null;
  let error: string | null = null;
  // Chat replies reach a visitor who is still in the chat live; e-mail is the fallback once they've left.
  const visitorPresent = conv.channel === "chat" && conv.visitorSeenAt !== null && Date.now() - conv.visitorSeenAt.getTime() < CHAT_AWAY_MS;
  if (!input.internal && conv.contactEmail && !visitorPresent) {
    const s = await db.query.site.findFirst({ where: eq(site.id, conv.siteId), columns: { name: true } });
    const previous = await db
      .select({ id: message.emailMessageId })
      .from(message)
      .where(and(eq(message.conversationId, conv.id), isNotNull(message.emailMessageId)))
      .orderBy(desc(message.createdAt))
      .limit(1);
    const emailId = `<${messageId}@${fromDomain(from)}>`;
    const headers: Record<string, string> = { "Message-ID": emailId };
    if (previous[0]?.id) Object.assign(headers, { "In-Reply-To": previous[0].id, References: previous[0].id });
    try {
      const inbound = inboundDomain();
      const files = await mailAttachments(messageId);
      const sent = await sendMail({
        to: [conv.contactEmail],
        subject: replySubject(conv.subject),
        text: body,
        html: textToHtml(body),
        fromName: s?.name,
        headers,
        replyTo: inbound ? replyAddress(conv.id, inbound) : undefined,
        attachments: files.length ? files : undefined,
      });
      delivered = sent ? true : null;
      error = sent ? null : "E-mail isn't configured on this instance (RESEND_API_KEY / EMAIL_FROM).";
      if (sent) await db.update(message).set({ emailMessageId: emailId }).where(eq(message.id, messageId));
    } catch (e) {
      delivered = false;
      error = e instanceof Error ? e.message : String(e);
    }
    if (error) await db.update(message).set({ deliveryError: error }).where(eq(message.id, messageId));
  }

  await emit({ type: "conversation.message", siteId: conv.siteId, payload: { conversationId: conv.id, messageId } });
  return { messageId, delivered, error };
}

/** The message's files as Resend attachments; past the size budget they're left out (staff can still share them otherwise). */
async function mailAttachments(messageId: string) {
  const rows = await db.select().from(inboxFile).where(eq(inboxFile.messageId, messageId));
  const out: { filename: string; content: string }[] = [];
  let total = 0;
  for (const r of rows) {
    if (total + r.size > LIMITS.emailFilesBytes) continue;
    const bytes = await readBytes(r.key);
    if (!bytes) continue;
    total += r.size;
    out.push({ filename: r.filename, content: Buffer.from(bytes).toString("base64") });
  }
  return out;
}

/** Files staff attach while writing a reply; they join the reply when it's sent, or expire after a day. */
export async function uploadDraftFiles(siteId: string, conversationId: string, authorId: string, files: IncomingFile[]) {
  const conv = await db.query.conversation.findFirst({ where: and(eq(conversation.id, conversationId), eq(conversation.siteId, siteId)), columns: { id: true } });
  if (!conv) return { ok: false as const, error: "Conversation not found." };
  const checked = checkUploads("inbox", files, LIMITS.replyFiles);
  if (!checked.ok) return checked;
  const attachments = await storeFiles(checked.files, { siteId, conversationId, messageId: null, source: "staff", uploadedBy: authorId });
  return { ok: true as const, attachments };
}

/** Status, priority, assignee, read state; emits so other tabs refresh. */
export async function updateConversation(
  siteId: string,
  id: string,
  patch: Partial<Pick<typeof conversation.$inferInsert, "status" | "priority" | "assigneeId" | "unread" | "snoozedUntil" | "tags">>,
) {
  // Leaving "snoozed" by hand forgets the wake-up time.
  const wake = patch.status && patch.status !== "snoozed" ? { snoozedUntil: null } : {};
  const [row] = await db
    .update(conversation)
    .set({ ...patch, ...wake, updatedAt: new Date() })
    .where(and(eq(conversation.id, id), eq(conversation.siteId, siteId)))
    .returning({ id: conversation.id });
  if (row) await emit({ type: "conversation.updated", siteId, payload: { conversationId: id } });
  return Boolean(row);
}

/**
 * Snoozed conversations whose time has come go back to open and unread. Runs
 * every minute in the API and lazily from the admin, so nothing depends on cron.
 */
export async function wakeSnoozed(siteId?: string) {
  const rows = await db
    .update(conversation)
    .set({ status: "open", unread: true, snoozedUntil: null, updatedAt: new Date() })
    .where(and(eq(conversation.status, "snoozed"), lte(conversation.snoozedUntil, new Date()), siteId ? eq(conversation.siteId, siteId) : undefined))
    .returning({ id: conversation.id, siteId: conversation.siteId });
  for (const r of rows) await emit({ type: "conversation.updated", siteId: r.siteId, payload: { conversationId: r.id } });
  return rows.length;
}

// -------------------------------------------------------------------- chat ---

/** Who is chatting: a signed-in customer and/or the anonymous cookie token. */
export type ChatVisitor = { token: string | null; user: { id: string; name: string | null; email: string } | null };

export type ChatAttachment = { id: string; name: string; size: number | null; type: string | null };
export type ChatMessage = { id: string; author: "customer" | "staff" | "ai" | "system"; name: string | null; body: string; attachments: ChatAttachment[]; createdAt: string };

export type ChatThread = { conversationId: string | null; status: Status | null; contact: { name: string | null; email: string | null }; messages: ChatMessage[] };

export const hashVisitorToken = (token: string) => createHash("sha256").update(`qubo-chat:${token}`).digest("hex");

const toChatMessage = (m: { id: string; authorType: ChatMessage["author"]; authorName: string | null; body: string; attachments: MessageAttachment[]; createdAt: Date }): ChatMessage => ({
  id: m.id,
  author: m.authorType,
  name: m.authorType === "customer" ? null : publicStaffName(m.authorName),
  body: m.body,
  attachments: m.attachments.flatMap((a) => (a.id ? [{ id: a.id, name: a.name, size: a.size ?? null, type: a.type ?? null }] : [])),
  createdAt: m.createdAt.toISOString(),
});

/**
 * The visitor's chat on this site. Signed-in customers get their latest chat;
 * an anonymous chat they started before signing in is claimed on the way.
 */
export async function findChat(siteId: string, v: ChatVisitor) {
  const chat = and(eq(conversation.siteId, siteId), eq(conversation.channel, "chat"));
  const byToken = v.token
    ? await db.query.conversation.findFirst({ where: and(chat, eq(conversation.visitorTokenHash, hashVisitorToken(v.token))) })
    : undefined;
  if (!v.user) return byToken ?? null;
  if (byToken && !byToken.customerId) {
    const [claimed] = await db
      .update(conversation)
      .set({ customerId: v.user.id, contactName: byToken.contactName ?? v.user.name, contactEmail: byToken.contactEmail ?? v.user.email, updatedAt: new Date() })
      .where(and(eq(conversation.id, byToken.id), isNull(conversation.customerId)))
      .returning();
    if (claimed) return claimed;
  }
  if (byToken?.customerId === v.user.id) return byToken;
  return (await db.query.conversation.findFirst({ where: and(chat, eq(conversation.customerId, v.user.id)), orderBy: desc(conversation.lastMessageAt) })) ?? null;
}

/** Public messages of the visitor's chat (never internal notes). Marks the visitor as present. */
export async function chatThread(siteId: string, v: ChatVisitor): Promise<ChatThread> {
  const conv = await findChat(siteId, v);
  const contact = { name: conv?.contactName ?? v.user?.name ?? null, email: conv?.contactEmail ?? v.user?.email ?? null };
  if (!conv) return { conversationId: null, status: null, contact, messages: [] };
  await chatSeen(conv.id);
  const rows = await db
    .select({ id: message.id, authorType: message.authorType, authorName: message.authorName, body: message.body, attachments: message.attachments, createdAt: message.createdAt })
    .from(message)
    .where(and(eq(message.conversationId, conv.id), eq(message.internal, false)))
    .orderBy(desc(message.createdAt))
    .limit(LIMITS.chatHistory);
  return { conversationId: conv.id, status: conv.status, contact, messages: rows.reverse().map(toChatMessage) };
}

export type ChatSendResult =
  | { ok: true; conversationId: string; created: boolean; message: ChatMessage }
  | { ok: false; error: "empty" | "too_long" | "invalid_email" | "no_identity" | "storage_unavailable" }
  | { ok: false; error: "bad_file"; message: string };

/** Visitor message: opens the chat on first send, reopens a resolved one later. */
export async function chatSend(
  siteId: string,
  v: ChatVisitor,
  input: { body: string; name?: string; email?: string; pagePath?: string; files?: IncomingFile[] },
): Promise<ChatSendResult> {
  const body = input.body.trim();
  const checked = checkUploads("chat", input.files ?? [], CHAT_ATTACHMENTS.perMessage);
  if (!checked.ok) return { ok: false, error: "bad_file", message: checked.error };
  if (!body && !checked.files.length) return { ok: false, error: "empty" };
  if (checked.files.length && !storageConfigured()) return { ok: false, error: "storage_unavailable" };
  if (body.length > LIMITS.chatMessageLength) return { ok: false, error: "too_long" };
  const email = input.email?.trim().toLowerCase() || null;
  if (email && !isEmail(email)) return { ok: false, error: "invalid_email" };
  const name = input.name?.trim().slice(0, 120) || null;
  if (!v.user && !v.token) return { ok: false, error: "no_identity" };

  const existing = await findChat(siteId, v);
  const now = new Date();
  if (!existing) {
    const contactName = v.user?.name ?? name;
    const contactEmail = v.user?.email ?? email;
    const { conversation: conv, messageId } = await db.transaction(async (tx) => {
      const opened = await openConversation(
        { siteId, channel: "chat", subject: chatSubject(body || checked.files[0]!.name), body, contactName, contactEmail, customerId: v.user?.id ?? null },
        tx,
      );
      await tx
        .update(conversation)
        .set({ visitorTokenHash: v.token ? hashVisitorToken(v.token) : null, visitorSeenAt: now, tags: input.pagePath ? [`page:${input.pagePath.slice(0, 120)}`] : [] })
        .where(eq(conversation.id, opened.conversation.id));
      if (input.pagePath) {
        // Same transaction = same now(); 1 ms earlier keeps the note above the first message.
        const createdAt = new Date(opened.conversation.createdAt.getTime() - 1);
        await tx
          .insert(message)
          .values({ conversationId: opened.conversation.id, authorType: "system", body: `Started on ${input.pagePath.slice(0, 300)}`, internal: true, createdAt });
      }
      return opened;
    });
    const attachments = await storeFiles(checked.files, { siteId, conversationId: conv.id, messageId, source: "chat", uploadedBy: v.user?.id });
    await linkFiles(messageId, attachments);
    await emit({ type: "conversation.created", siteId, payload: { conversationId: conv.id } });
    return {
      ok: true,
      conversationId: conv.id,
      created: true,
      message: toChatMessage({ id: messageId, authorType: "customer", authorName: null, body, attachments, createdAt: conv.createdAt }),
    };
  }

  const [msg] = await db
    .insert(message)
    .values({ conversationId: existing.id, authorType: "customer", authorId: v.user?.id ?? null, authorName: existing.contactName ?? name ?? existing.contactEmail, body })
    .returning();
  const attachments = await storeFiles(checked.files, { siteId, conversationId: existing.id, messageId: msg!.id, source: "chat", uploadedBy: v.user?.id });
  await linkFiles(msg!.id, attachments);
  await db
    .update(conversation)
    .set({
      lastMessageAt: now,
      updatedAt: now,
      visitorSeenAt: now,
      unread: true,
      status: "open",
      snoozedUntil: null,
      contactName: existing.contactName ?? name,
      contactEmail: existing.contactEmail ?? email,
    })
    .where(eq(conversation.id, existing.id));
  await emit({ type: "conversation.message", siteId, payload: { conversationId: existing.id, messageId: msg!.id } });
  return { ok: true, conversationId: existing.id, created: false, message: toChatMessage({ ...msg!, attachments }) };
}

/** A file the visitor may open: in their conversation and on a public message. */
export async function chatFile(conversationId: string, fileId: string) {
  const [row] = await db
    .select({ key: inboxFile.key, mime: inboxFile.mime, filename: inboxFile.filename })
    .from(inboxFile)
    .innerJoin(message, eq(message.id, inboxFile.messageId))
    .where(and(eq(inboxFile.id, fileId), eq(inboxFile.conversationId, conversationId), eq(message.internal, false)))
    .limit(1);
  return row ?? null;
}

/** The visitor still has the chat open (stream connected / heartbeat). */
export async function chatSeen(conversationId: string) {
  await db.update(conversation).set({ visitorSeenAt: new Date() }).where(eq(conversation.id, conversationId));
}

/** One message as the visitor may see it; null for internal notes or other conversations. */
export async function chatMessage(conversationId: string, messageId: string): Promise<ChatMessage | null> {
  const m = await db.query.message.findFirst({
    where: and(eq(message.id, messageId), eq(message.conversationId, conversationId), eq(message.internal, false)),
  });
  return m ? toChatMessage(m) : null;
}



// ---------------------------------------------------------- inbound e-mail ---

export type InboundEmail = {
  id: string;
  messageId: string | null;
  from: string;
  to: string[];
  cc: string[];
  receivedFor: string[];
  subject: string;
  text: string | null;
  html: string | null;
  headers: Record<string, string | string[] | undefined>;
  dmarc: string | null;
  /** `load` fetches the bytes (Resend download URL); missing when they can't be fetched. */
  attachments: { filename: string; size?: number; inline?: boolean; load?: () => Promise<Uint8Array | null> }[];
};

/** Inline images this small are signature logos and tracking pixels, not something the customer sent. */
const INLINE_NOISE_BYTES = 30_000;

/** Downloads and checks a received e-mail's files; what can't be imported is listed by name. */
async function importEmailFiles(list: InboundEmail["attachments"]) {
  const wanted = list.filter((a) => !(a.inline && (a.size ?? 0) < INLINE_NOISE_BYTES));
  const files: { filename: string; bytes: Uint8Array }[] = [];
  const skipped: string[] = [];
  for (const a of wanted) {
    const name = cleanFilename(a.filename);
    if (files.length >= LIMITS.emailFiles || !a.load || !storageConfigured()) {
      skipped.push(name);
      continue;
    }
    const bytes = await a.load().catch(() => null);
    const ok = bytes && checkUploads("inbox", [{ filename: name, bytes }], 1).ok;
    if (ok) files.push({ filename: name, bytes: bytes! });
    else skipped.push(name);
  }
  return { files: checkUploads("inbox", files, LIMITS.emailFiles), skipped };
}

export type ReceiveResult =
  | { ok: true; conversationId: string; created: boolean }
  | { ok: false; reason: "duplicate" | "auto_reply" | "dmarc_fail" | "no_route" | "bad_sender" | "rate_limited" | "loop" };

const inboundLimiter = createRateLimiter(INBOUND_PER_HOUR, 3_600_000);
/** A sender's mail that lost its headers joins their open thread with the same subject from this period. */
const SUBJECT_MATCH_MS = 30 * 86_400_000;

/**
 * An e-mail Resend received for this instance. Threads by reply address, then
 * by Message-ID references, then by sender + subject; otherwise it opens an
 * `email` conversation on the site its address names.
 */
export async function receiveEmail(mail: InboundEmail): Promise<ReceiveResult> {
  const sender = parseAddress(mail.from);
  if (!sender) return { ok: false, reason: "bad_sender" };
  const own = parseAddress(fromAddress())?.email;
  if (own && sender.email === own) return { ok: false, reason: "loop" };
  if (mail.dmarc === "fail") return { ok: false, reason: "dmarc_fail" };
  if (isAutoReply(mail.headers, mail.from)) return { ok: false, reason: "auto_reply" };
  // Resend's id is stable across webhook retries; the Message-ID also catches the same mail sent to two of our addresses.
  const dedupeIds = [`resend:${mail.id}`, mail.messageId].filter((v): v is string => Boolean(v));
  const seen = await db.query.message.findFirst({ where: inArray(message.emailMessageId, dedupeIds), columns: { id: true } });
  if (seen) return { ok: false, reason: "duplicate" };

  const route = inboundRoute([...mail.to, ...mail.cc, ...mail.receivedFor], inboundDomain());
  let conv: typeof conversation.$inferSelect | undefined;
  if (route && "conversationId" in route) {
    conv = await db.query.conversation.findFirst({ where: eq(conversation.id, route.conversationId) });
  }
  if (!conv) {
    const refs = referencedIds(mail.headers);
    if (refs.length) {
      const [hit] = await db
        .select({ conversationId: message.conversationId })
        .from(message)
        .where(inArray(message.emailMessageId, refs))
        .orderBy(desc(message.createdAt))
        .limit(1);
      if (hit) conv = await db.query.conversation.findFirst({ where: eq(conversation.id, hit.conversationId) });
    }
  }
  let siteId = conv?.siteId;
  if (!siteId && route && "siteSlug" in route) {
    siteId = (await db.query.site.findFirst({ where: eq(site.slug, route.siteSlug), columns: { id: true } }))?.id;
  }
  if (!siteId) return { ok: false, reason: "no_route" };
  if (!inboundLimiter(`${siteId}:${sender.email}`)) return { ok: false, reason: "rate_limited" };

  if (!conv) {
    const recent = await db.query.conversation.findMany({
      where: and(eq(conversation.siteId, siteId), eq(conversation.contactEmail, sender.email), ne(conversation.status, "resolved"), gt(conversation.lastMessageAt, new Date(Date.now() - SUBJECT_MATCH_MS))),
      orderBy: desc(conversation.lastMessageAt),
      limit: 20,
    });
    const subject = baseSubject(mail.subject);
    conv = subject ? recent.find((c) => baseSubject(c.subject) === subject) : undefined;
  }

  const raw = mail.text?.trim() || (mail.html ? htmlToText(mail.html) : "");
  let body = (conv ? stripQuoted(raw) : raw).slice(0, LIMITS.replyLength) || "(empty e-mail)";
  const imported = await importEmailFiles(mail.attachments);
  const files = imported.files.ok ? imported.files.files : [];
  if (imported.skipped.length) {
    // Unsupported types, oversized or unreachable: staff see what was sent and can ask for it another way.
    body += `\n\n[Not imported: ${imported.skipped.join(", ")}]`;
  }
  const emailMessageId = mail.messageId ?? `resend:${mail.id}`;

  if (!conv) {
    const opened = await openConversation({
      siteId,
      channel: "email",
      subject: mail.subject.trim() || "(no subject)",
      body,
      contactName: sender.name,
      contactEmail: sender.email,
    });
    await db.update(message).set({ emailMessageId }).where(eq(message.id, opened.messageId));
    await linkFiles(opened.messageId, await storeFiles(files, { siteId, conversationId: opened.conversation.id, messageId: opened.messageId, source: "email" }));
    await emit({ type: "conversation.created", siteId, payload: { conversationId: opened.conversation.id } });
    return { ok: true, conversationId: opened.conversation.id, created: true };
  }

  const [msg] = await db
    .insert(message)
    .values({ conversationId: conv.id, authorType: "customer", authorId: null, authorName: sender.name ?? sender.email, body, emailMessageId })
    .returning({ id: message.id });
  await linkFiles(msg!.id, await storeFiles(files, { siteId: conv.siteId, conversationId: conv.id, messageId: msg!.id, source: "email" }));
  await db
    .update(conversation)
    .set({
      status: "open",
      unread: true,
      snoozedUntil: null,
      lastMessageAt: new Date(),
      updatedAt: new Date(),
      contactEmail: conv.contactEmail ?? sender.email,
      contactName: conv.contactName ?? sender.name,
    })
    .where(eq(conversation.id, conv.id));
  await emit({ type: "conversation.message", siteId: conv.siteId, payload: { conversationId: conv.id, messageId: msg!.id } });
  return { ok: true, conversationId: conv.id, created: false };
}
