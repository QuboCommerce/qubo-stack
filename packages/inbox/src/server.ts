import { db, sql } from "@qubo/db/client";
import { conversation, form, formSubmission, message, site, type MessageAttachment } from "@qubo/db/schema";
import { publish } from "@qubo/realtime/server";
import { and, count, desc, eq, isNotNull } from "drizzle-orm";
import { cleanFormData, formNameFromKey, formThread, isSignupOnly, LIMITS, replySubject, textToHtml, type Channel } from "./index";

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

type Mail = { to: string[]; subject: string; text: string; html: string; fromName?: string; replyTo?: string; headers?: Record<string, string> };

/** Resend; returns null when e-mail isn't configured on this instance. */
async function sendMail(mail: Mail): Promise<{ sent: true } | null> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = fromAddress();
  if (!apiKey || !from) return null;
  const sender = mail.fromName ? `${mail.fromName.replace(/[<>"]/g, "")} <${from.match(/<([^>]+)>/)?.[1] ?? from}>` : from;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from: sender, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html, reply_to: mail.replyTo, headers: mail.headers }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return { sent: true };
}

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY?.trim() && fromAddress());

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
  await db
    .update(conversation)
    .set({ lastMessageAt: new Date(), updatedAt: new Date(), unread: false, assigneeId: conv.assigneeId ?? input.author.id })
    .where(eq(conversation.id, conv.id));

  let delivered: boolean | null = null;
  let error: string | null = null;
  if (!input.internal && conv.contactEmail) {
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
      const sent = await sendMail({ to: [conv.contactEmail], subject: replySubject(conv.subject), text: body, html: textToHtml(body), fromName: s?.name, headers });
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

/** Status, priority, assignee, read state; emits so other tabs refresh. */
export async function updateConversation(
  siteId: string,
  id: string,
  patch: Partial<Pick<typeof conversation.$inferInsert, "status" | "priority" | "assigneeId" | "unread" | "snoozedUntil" | "tags">>,
) {
  const [row] = await db
    .update(conversation)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(conversation.id, id), eq(conversation.siteId, siteId)))
    .returning({ id: conversation.id });
  if (row) await emit({ type: "conversation.updated", siteId, payload: { conversationId: id } });
  return Boolean(row);
}
