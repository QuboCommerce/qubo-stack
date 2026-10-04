/**
 * Inbox AI: triage (summary, category, urgency, spam) and reply drafts, on the
 * organisation's own model and key. Nothing here sends anything to a customer;
 * drafts land in the composer for a human to edit and send.
 */
import { AiError, AI_LIMITS, cleanDraft, draftPrompt, parseTriage, requireAi, run, searchTerms, triagePrompt, type DraftContext, type PromptMessage, type Triage } from "@qubo/ai/server";
import { db, sql as pg } from "@qubo/db/client";
import { conversation, inventoryItem, message, order, product, productVariant, site, siteSettings, user, type ConversationAi } from "@qubo/db/schema";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { publish } from "@qubo/realtime/server";
import { PRIORITIES, publicStaffName, type Priority } from "./index";

export { AiError } from "@qubo/ai/server";

async function loadThread(siteId: string, conversationId: string) {
  const [row] = await db
    .select({ c: conversation, orgId: site.organizationId, siteName: site.name, instructions: siteSettings.aiInstructions })
    .from(conversation)
    .innerJoin(site, eq(site.id, conversation.siteId))
    .leftJoin(siteSettings, eq(siteSettings.siteId, site.id))
    .where(and(eq(conversation.id, conversationId), eq(conversation.siteId, siteId)))
    .limit(1);
  if (!row) return null;
  const recent = await db
    .select({ id: message.id, authorType: message.authorType, authorName: message.authorName, body: message.body, attachments: message.attachments, createdAt: message.createdAt })
    .from(message)
    .where(and(eq(message.conversationId, conversationId), eq(message.internal, false)))
    .orderBy(desc(message.createdAt))
    .limit(AI_LIMITS.historyMessages);
  recent.reverse();
  const messages: PromptMessage[] = recent.map((m) => ({
    from: m.authorType,
    name: m.authorType === "customer" ? null : m.authorName,
    body: [m.body, ...(m.attachments ?? []).map((a) => `[attachment: ${a.name}]`)].filter(Boolean).join("\n"),
    at: m.createdAt,
  }));
  const lastCustomer = [...recent].reverse().find((m) => m.authorType === "customer") ?? null;
  return { ...row, messages, lastCustomer };
}

const rank = (p: Priority) => PRIORITIES.indexOf(p);

/** Category tag the inbox filters on; replaces the previous one so re-triage doesn't pile tags up. */
export const aiTag = (category: string) => `ai:${category}`;

export function applyTriage(current: { tags: string[]; priority: Priority }, t: Triage) {
  const tags = current.tags.filter((x) => !x.startsWith("ai:"));
  tags.push(aiTag(t.category));
  if (t.spam && !tags.includes("spam")) tags.push("spam");
  // AI may raise priority, never lower what a human (or an earlier message) set.
  const priority = rank(t.urgency) > rank(current.priority) ? t.urgency : current.priority;
  return { tags, priority };
}

/**
 * Triage one conversation as of its latest customer message. `force` re-runs even
 * when that message was already read (the admin's "Run again").
 */
export async function triageConversation(siteId: string, conversationId: string, opts: { force?: boolean } = {}): Promise<ConversationAi | null> {
  const t = await loadThread(siteId, conversationId);
  if (!t?.lastCustomer) return null;
  if (!opts.force && t.c.ai?.messageId === t.lastCustomer.id) return t.c.ai;
  const ready = await requireAi(t.orgId, "triage", { manual: opts.force });
  const out = await run(ready, { orgId: t.orgId, siteId, feature: "triage" }, triagePrompt({ siteName: t.siteName, subject: t.c.subject, channel: t.c.channel, messages: t.messages }), {
    json: true,
    maxTokens: 400,
    temperature: 0,
  });
  const parsed = parseTriage(out.text);
  if (!parsed) throw new AiError("The model's answer wasn't valid triage JSON.", "bad_output");
  const ai: ConversationAi = { ...parsed, model: ready.endpoint.model, messageId: t.lastCustomer.id, at: new Date().toISOString() };
  const next = applyTriage({ tags: t.c.tags, priority: t.c.priority }, parsed);
  await db.update(conversation).set({ ai, tags: next.tags, priority: next.priority }).where(eq(conversation.id, conversationId));
  await publish(pg, { type: "conversation.updated", siteId, payload: { conversationId } }).catch(() => {});
  return ai;
}

// ------------------------------------------------------------- sweep ---

/** Conversation id -> earliest retry, so a failing provider isn't hammered every sweep. */
const backoff = new Map<string, number>();

/**
 * Finds conversations whose newest customer message hasn't been triaged and has
 * been quiet for a few seconds (people send three chat lines in a row), in
 * organisations that have triage on. Runs every few seconds in the API.
 */
export async function triageDue(now = Date.now()) {
  const quietBefore = new Date(now - AI_LIMITS.triageDelayMs).toISOString();
  const rows = await db.execute<{ id: string; site_id: string }>(sql`
    select c.id, c.site_id
    from conversation c
    join site s on s.id = c.site_id
    join ai_settings a on a.organization_id = s.organization_id and a.triage
    cross join lateral (
      select m.id, m.created_at from message m
      where m.conversation_id = c.id and m.author_type = 'customer' and not m.internal
      order by m.created_at desc limit 1
    ) last
    where c.status <> 'resolved'
      and c.last_message_at > now() - interval '3 days'
      and last.created_at <= ${quietBefore}::timestamp
      and (c.ai is null or c.ai->>'messageId' <> last.id::text)
    order by c.last_message_at desc
    limit ${AI_LIMITS.triageBatch * 3}
  `);
  let done = 0;
  for (const r of rows) {
    if (done >= AI_LIMITS.triageBatch) break;
    if ((backoff.get(r.id) ?? 0) > now) continue;
    try {
      await triageConversation(r.site_id, r.id);
      backoff.delete(r.id);
      done++;
    } catch (e) {
      const code = e instanceof AiError ? e.code : "provider";
      // Budget and plan problems clear on their own schedule; check back in an hour.
      const wait = code === "budget" || code === "not_entitled" || code === "key" ? 3_600_000 : 10 * 60_000;
      backoff.set(r.id, now + wait);
      if (code !== "budget" && code !== "not_entitled") console.error("[inbox-ai] triage failed", r.id, e instanceof Error ? e.message : e);
    }
  }
  for (const [id, at] of backoff) if (at < now - 3_600_000) backoff.delete(id);
  return done;
}

// ------------------------------------------------------------ drafts ---

async function findProducts(siteId: string, text: string, named: string[]) {
  const terms = [...new Set([...named.map((n) => n.toLowerCase()), ...searchTerms(text)])].slice(0, 8);
  if (!terms.length) return [];
  const like = terms.flatMap((t) => [ilike(product.name, `%${t}%`), ilike(productVariant.sku, `%${t}%`)]);
  // Score per product: named products (from triage) count double, then each matching term.
  const score = sql<number>`(${sql.join(
    terms.map((t, i) => sql`(case when bool_or(${product.name} ilike ${`%${t}%`} or coalesce(${productVariant.sku}, '') ilike ${`%${t}%`}) then ${i < named.length ? 2 : 1} else 0 end)`),
    sql` + `,
  )})::int`;
  const rows = await db
    .select({
      name: product.name,
      price: product.basePrice,
      sku: sql<string | null>`min(${productVariant.sku})`,
      variantPrice: sql<string | null>`min(${productVariant.price})`,
      stock: sql<number | null>`sum(greatest(${inventoryItem.quantity} - ${inventoryItem.reservedQuantity}, 0)) filter (where ${inventoryItem.tracked})::int`,
      score,
    })
    .from(product)
    .leftJoin(productVariant, eq(productVariant.productId, product.id))
    .leftJoin(inventoryItem, eq(inventoryItem.variantId, productVariant.id))
    .where(and(eq(product.siteId, siteId), eq(product.isArchived, false), or(...like)))
    .groupBy(product.id)
    .orderBy(desc(score), desc(product.updatedAt))
    .limit(5);
  return rows.map((r) => ({ name: r.name, sku: r.sku, price: r.variantPrice ?? r.price, stock: r.stock }));
}

async function recentOrders(siteId: string, customerId: string | null, email: string | null) {
  const who = [customerId ? eq(order.customerId, customerId) : null, email ? eq(sql`lower(${order.customerEmail})`, email.toLowerCase()) : null].filter((x) => x !== null);
  if (!who.length) return [];
  const rows = await db
    .select({ number: order.orderNumber, status: order.status, total: order.total, currency: order.currency, createdAt: order.createdAt })
    .from(order)
    .where(and(eq(order.siteId, siteId), or(...who)))
    .orderBy(desc(order.createdAt))
    .limit(5);
  return rows.map((o) => ({ number: o.number, status: o.status, total: o.total, currency: o.currency, placedAt: o.createdAt.toISOString().slice(0, 10) }));
}

/** A reply draft for the staff member to edit. Never sent automatically. */
export async function draftReply(input: { siteId: string; conversationId: string; staffId: string; hint?: string | null }) {
  const t = await loadThread(input.siteId, input.conversationId);
  if (!t) throw new AiError("Conversation not found.", "not_configured");
  if (!t.messages.length) throw new AiError("Nothing to reply to yet.", "bad_output");
  const ready = await requireAi(t.orgId, "draft");
  const [staff] = await db.select({ name: user.name }).from(user).where(eq(user.id, input.staffId)).limit(1);
  const customerText = t.messages
    .filter((m) => m.from === "customer")
    .slice(-3)
    .map((m) => m.body)
    .join("\n");
  const [orders, products] = await Promise.all([
    recentOrders(input.siteId, t.c.customerId, t.c.contactEmail),
    findProducts(input.siteId, `${t.c.subject}\n${customerText}`, t.c.ai?.extracted?.products ?? []),
  ]);
  const ctx: DraftContext = {
    siteName: t.siteName,
    subject: t.c.subject,
    channel: t.c.channel,
    instructions: t.instructions,
    staffName: publicStaffName(staff?.name ?? null),
    language: t.c.ai?.language ?? null,
    messages: t.messages,
    orders,
    products: products.map((p) => ({ name: p.name, sku: p.sku, price: p.price, currency: orders[0]?.currency ?? "EUR", stock: p.stock })),
    hint: input.hint,
  };
  const out = await run(ready, { orgId: t.orgId, siteId: input.siteId, feature: "draft" }, draftPrompt(ctx), { maxTokens: 700 });
  const text = cleanDraft(out.text);
  if (!text) throw new AiError("The model returned an empty draft.", "bad_output");
  return { text, used: { orders: orders.length, products: products.length } };
}
