import "server-only";
import { db } from "@qubo/db/client";
import { conversation, form, formSubmission, inboxFile, message, order, organizationMember, siteCustomer, user } from "@qubo/db/schema";
import { wakeSnoozed } from "@qubo/inbox/server";
import { and, asc, count, desc, eq, ilike, inArray, ne, or, type SQL } from "drizzle-orm";

export const INBOX_VIEWS = ["open", "mine", "pending", "snoozed", "resolved", "all"] as const;
export type InboxView = (typeof INBOX_VIEWS)[number];

export const parseView = (v: string | undefined): InboxView => (INBOX_VIEWS as readonly string[]).includes(v ?? "") ? (v as InboxView) : "open";

function viewFilter(view: InboxView, userId: string): SQL | undefined {
  switch (view) {
    case "open":
      return eq(conversation.status, "open");
    case "mine":
      return and(eq(conversation.assigneeId, userId), inArray(conversation.status, ["open", "pending"]));
    case "snoozed":
      return eq(conversation.status, "snoozed");
    case "pending":
      return eq(conversation.status, "pending");
    case "resolved":
      return eq(conversation.status, "resolved");
    case "all":
      return undefined;
  }
}

export async function listConversations(siteId: string, view: InboxView, userId: string, q?: string) {
  await wakeSnoozed(siteId);
  const search = q?.trim()
    ? or(ilike(conversation.subject, `%${q.trim()}%`), ilike(conversation.contactEmail, `%${q.trim()}%`), ilike(conversation.contactName, `%${q.trim()}%`))
    : undefined;
  const rows = await db
    .select({
      id: conversation.id,
      channel: conversation.channel,
      subject: conversation.subject,
      status: conversation.status,
      priority: conversation.priority,
      unread: conversation.unread,
      contactName: conversation.contactName,
      contactEmail: conversation.contactEmail,
      assigneeId: conversation.assigneeId,
      lastMessageAt: conversation.lastMessageAt,
      snoozedUntil: conversation.snoozedUntil,
    })
    .from(conversation)
    .where(and(eq(conversation.siteId, siteId), viewFilter(view, userId), search))
    .orderBy(desc(conversation.lastMessageAt))
    .limit(100);
  if (!rows.length) return [];

  // Preview line: latest public message per conversation.
  const previews = await db
    .selectDistinctOn([message.conversationId], { conversationId: message.conversationId, body: message.body, authorType: message.authorType })
    .from(message)
    .where(and(eq(message.internal, false), inArray(message.conversationId, rows.map((r) => r.id))))
    .orderBy(message.conversationId, desc(message.createdAt));
  const byId = new Map(previews.map((p) => [p.conversationId, p]));
  return rows.map((r) => ({ ...r, preview: byId.get(r.id)?.body.slice(0, 140) ?? "", lastFrom: byId.get(r.id)?.authorType ?? "customer" }));
}
export type ConversationRow = Awaited<ReturnType<typeof listConversations>>[number];

export async function viewCounts(siteId: string, userId: string) {
  const entries = await Promise.all(
    INBOX_VIEWS.filter((v) => v !== "all").map(async (v) => {
      const [row] = await db
        .select({ value: count() })
        .from(conversation)
        .where(and(eq(conversation.siteId, siteId), viewFilter(v, userId)));
      return [v, row?.value ?? 0] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<Exclude<InboxView, "all">, number>;
}

export async function getConversation(siteId: string, id: string) {
  const conv = await db.query.conversation.findFirst({ where: and(eq(conversation.id, id), eq(conversation.siteId, siteId)) });
  if (!conv) return null;
  const [messages, fileRows, submission, linkedOrder, customer, history] = await Promise.all([
    db.select().from(message).where(eq(message.conversationId, id)).orderBy(asc(message.createdAt)),
    db.select({ id: inboxFile.id, source: inboxFile.source, expiresAt: inboxFile.expiresAt }).from(inboxFile).where(eq(inboxFile.conversationId, id)),
    conv.formSubmissionId
      ? db
          .select({ data: formSubmission.data, pagePath: formSubmission.pagePath, locale: formSubmission.locale, formName: form.name })
          .from(formSubmission)
          .innerJoin(form, eq(form.id, formSubmission.formId))
          .where(eq(formSubmission.id, conv.formSubmissionId))
          .then((r) => r[0] ?? null)
      : null,
    conv.orderId
      ? db.query.order.findFirst({ where: eq(order.id, conv.orderId), columns: { id: true, orderNumber: true, total: true, currency: true, status: true } })
      : null,
    conv.contactEmail
      ? db.query.siteCustomer.findFirst({ where: and(eq(siteCustomer.siteId, siteId), eq(siteCustomer.email, conv.contactEmail)) })
      : null,
    conv.contactEmail
      ? db
          .select({ id: conversation.id, subject: conversation.subject, status: conversation.status, lastMessageAt: conversation.lastMessageAt })
          .from(conversation)
          .where(and(eq(conversation.siteId, siteId), eq(conversation.contactEmail, conv.contactEmail), ne(conversation.id, id)))
          .orderBy(desc(conversation.lastMessageAt))
          .limit(5)
      : [],
  ]);
  // Attachments without a row here have expired; the message keeps their names.
  const files = Object.fromEntries(fileRows.map((f) => [f.id, { source: f.source, expiresAt: f.expiresAt?.toISOString() ?? null }]));
  return { ...conv, messages, files, submission, order: linkedOrder ?? null, customer: customer ?? null, history };
}
export type ConversationDetail = NonNullable<Awaited<ReturnType<typeof getConversation>>>;

/** People who can be assigned: members of the site's organisation. */
export async function assignableMembers(organizationId: string) {
  return db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(organizationMember)
    .innerJoin(user, eq(user.id, organizationMember.userId))
    .where(eq(organizationMember.organizationId, organizationId))
    .orderBy(asc(user.name));
}
