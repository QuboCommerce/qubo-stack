import "server-only";
import { db } from "@qubo/db/client";
import { conversation, form, formSubmission, inboxFile, message, order, organizationMember, siteCustomer, user } from "@qubo/db/schema";
import { wakeSnoozed } from "@qubo/inbox/server";
import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, ne, or, sql, type SQL } from "drizzle-orm";

import { INBOX_VIEWS, LIST_LIMIT, type InboxLens, type InboxSort, type InboxView, type ListOptions } from "./inbox-shared";

export * from "./inbox-shared";

function lensFilter(lens: InboxLens): SQL | undefined {
  const notTicket = isNull(conversation.ticketNumber);
  switch (lens) {
    case "all":
      return undefined;
    case "tickets":
      return isNotNull(conversation.ticketNumber);
    case "forms":
      return and(eq(conversation.channel, "form"), notTicket);
    case "email":
      return and(eq(conversation.channel, "email"), notTicket);
    case "chats":
      return and(eq(conversation.channel, "chat"), notTicket);
  }
}

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

const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

function optionFilters(o: ListOptions, userId: string): SQL | undefined {
  const q = o.q;
  const search = q
    ? or(
        ilike(conversation.subject, like(q)),
        ilike(conversation.contactEmail, like(q)),
        ilike(conversation.contactName, like(q)),
        sql`exists (select 1 from ${message} where ${message.conversationId} = ${conversation.id} and ${message.body} ilike ${like(q)})`,
        ...(/^#?\d{1,7}$/.test(q) ? [eq(conversation.ticketNumber, Number(q.replace("#", "")))] : []),
      )
    : undefined;
  return and(
    search,
    o.unread ? eq(conversation.unread, true) : undefined,
    o.priority ? inArray(conversation.priority, ["high", "urgent"]) : undefined,
    o.assignee === "me" ? eq(conversation.assigneeId, userId) : o.assignee === "none" ? isNull(conversation.assigneeId) : o.assignee ? eq(conversation.assigneeId, o.assignee) : undefined,
  );
}

const sortOrder = (sort: InboxSort) =>
  sort === "oldest"
    ? [asc(conversation.lastMessageAt)]
    : sort === "priority"
      ? [sql`case ${conversation.priority} when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end`, desc(conversation.lastMessageAt)]
      : sort === "unread"
        ? [desc(conversation.unread), desc(conversation.lastMessageAt)]
        : [desc(conversation.lastMessageAt)];

export async function listConversations(siteId: string, lens: InboxLens, view: InboxView, userId: string, o: ListOptions) {
  await wakeSnoozed(siteId);
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
      tags: conversation.tags,
      ticketNumber: conversation.ticketNumber,
      createdAt: conversation.createdAt,
      formName: form.name,
    })
    .from(conversation)
    .leftJoin(formSubmission, eq(formSubmission.id, conversation.formSubmissionId))
    .leftJoin(form, eq(form.id, formSubmission.formId))
    .where(and(eq(conversation.siteId, siteId), lensFilter(lens), viewFilter(view, userId), optionFilters(o, userId)))
    .orderBy(...sortOrder(o.sort))
    .limit(LIST_LIMIT);
  if (!rows.length) return [];

  // Preview line: latest public message per conversation.
  const previews = await db
    .selectDistinctOn([message.conversationId], { conversationId: message.conversationId, body: message.body, authorType: message.authorType })
    .from(message)
    .where(and(eq(message.internal, false), inArray(message.conversationId, rows.map((r) => r.id))))
    .orderBy(message.conversationId, desc(message.createdAt));
  const byId = new Map(previews.map((p) => [p.conversationId, p]));
  return rows.map((r) => ({ ...r, preview: byId.get(r.id)?.body.slice(0, 160) ?? "", lastFrom: byId.get(r.id)?.authorType ?? "customer" }));
}
export type ConversationRow = Awaited<ReturnType<typeof listConversations>>[number];

export async function viewCounts(siteId: string, lens: InboxLens, userId: string, o: ListOptions) {
  const views = INBOX_VIEWS.filter((v): v is Exclude<InboxView, "all"> => v !== "all");
  const [row] = await db
    .select(Object.fromEntries(views.map((v) => [v, sql<number>`(count(*) filter (where ${viewFilter(v, userId)}))::int`])))
    .from(conversation)
    .where(and(eq(conversation.siteId, siteId), lensFilter(lens), optionFilters(o, userId)));
  return (row ?? Object.fromEntries(views.map((v) => [v, 0]))) as Record<Exclude<InboxView, "all">, number>;
}

/** Open threads per lens, for the lens tabs (one query). */
export async function lensCounts(siteId: string) {
  const [row] = await db
    .select({
      all: sql<number>`count(*)::int`,
      forms: sql<number>`count(*) filter (where ${conversation.channel} = 'form' and ${conversation.ticketNumber} is null)::int`,
      email: sql<number>`count(*) filter (where ${conversation.channel} = 'email' and ${conversation.ticketNumber} is null)::int`,
      chats: sql<number>`count(*) filter (where ${conversation.channel} = 'chat' and ${conversation.ticketNumber} is null)::int`,
      tickets: sql<number>`count(*) filter (where ${conversation.ticketNumber} is not null)::int`,
    })
    .from(conversation)
    .where(and(eq(conversation.siteId, siteId), eq(conversation.status, "open")));
  return row ?? { all: 0, forms: 0, email: 0, chats: 0, tickets: 0 };
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
