import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { order } from "./orders";
import { site } from "./site";
import { formSubmission } from "./studio";

/**
 * Inbox. One conversation per thread, whatever the channel it arrived on;
 * every message (customer, staff, AI, system) is a row so the trail stays
 * auditable. Anonymous contacts are identified by name/e-mail only.
 */
export const conversationChannelEnum = pgEnum("conversation_channel", ["chat", "email", "form", "portal", "system"]);
export const conversationStatusEnum = pgEnum("conversation_status", ["open", "pending", "resolved", "snoozed"]);
export const conversationPriorityEnum = pgEnum("conversation_priority", ["low", "normal", "high", "urgent"]);
export const messageAuthorEnum = pgEnum("message_author", ["customer", "staff", "ai", "system"]);

/** Display copy of a file on a message. `id` points at `inbox_file`; `url` is only set for links that live elsewhere. */
export type MessageAttachment = { id?: string; name: string; url?: string; size?: number; type?: string };

/** What the inbox AI made of a conversation, as of `messageId` (the last customer message it read). */
export type ConversationAi = {
  summary: string;
  category: string;
  sentiment: "positive" | "neutral" | "negative";
  urgency: "low" | "normal" | "high" | "urgent";
  language: string | null;
  spam: boolean;
  extracted: { orderNumber?: string | null; phone?: string | null; products?: string[] };
  model: string;
  messageId: string;
  at: string;
};

export const conversation = pgTable(
  "conversation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "cascade" }),
    channel: conversationChannelEnum("channel").notNull(),
    subject: text("subject").notNull(),
    status: conversationStatusEnum("status").notNull().default("open"),
    priority: conversationPriorityEnum("priority").notNull().default("normal"),
    assigneeId: text("assignee_id").references(() => user.id, { onDelete: "set null" }),
    customerId: text("customer_id").references(() => user.id, { onDelete: "set null" }),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    orderId: uuid("order_id").references(() => order.id, { onDelete: "set null" }),
    formSubmissionId: uuid("form_submission_id").references(() => formSubmission.id, { onDelete: "set null" }),
    tags: text("tags").array().notNull().default([]),
    /** Chat: sha256 of the anonymous visitor's cookie token (the token itself never hits the DB). */
    visitorTokenHash: text("visitor_token_hash"),
    /** Chat: last time the visitor had the chat open; staff replies are e-mailed only when they're away. */
    visitorSeenAt: timestamp("visitor_seen_at"),
    ai: jsonb("ai").$type<ConversationAi>(),
    /** True while the latest customer message hasn't been opened by staff. */
    unread: boolean("unread").notNull().default(true),
    snoozedUntil: timestamp("snoozed_until"),
    slaDueAt: timestamp("sla_due_at"),
    lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("conversation_site_status_last_idx").on(t.siteId, t.status, t.lastMessageAt),
    index("conversation_contact_email_idx").on(t.siteId, t.contactEmail),
    uniqueIndex("conversation_visitor_token_idx").on(t.siteId, t.visitorTokenHash),
    index("conversation_customer_idx").on(t.siteId, t.customerId),
  ],
);

export const message = pgTable(
  "message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    authorType: messageAuthorEnum("author_type").notNull(),
    authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
    authorName: text("author_name"),
    body: text("body").notNull(),
    bodyHtml: text("body_html"),
    attachments: jsonb("attachments").$type<MessageAttachment[]>().notNull().default([]),
    /** Staff-only note: never sent or shown to the customer. */
    internal: boolean("internal").notNull().default(false),
    /** RFC 5322 Message-ID of the e-mail this row was sent as / received from (threading). */
    emailMessageId: text("email_message_id"),
    /** Set when an outbound e-mail failed; the reply is stored regardless. */
    deliveryError: text("delivery_error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("message_conversation_created_idx").on(t.conversationId, t.createdAt), index("message_email_id_idx").on(t.emailMessageId)],
);

export const inboxFileSourceEnum = pgEnum("inbox_file_source", ["chat", "email", "form", "staff"]);

/**
 * A private file sent in a conversation. Bytes live in storage under
 * `inbox/<site>/<conversation>/<id>.<ext>`; only staff of the site and the
 * conversation's own visitor can read them. Chat uploads expire unless staff keep them.
 */
export const inboxFile = pgTable(
  "inbox_file",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    /** Null while uploaded but not yet sent. */
    messageId: uuid("message_id").references(() => message.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    filename: text("filename").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    source: inboxFileSourceEnum("source").notNull(),
    uploadedBy: text("uploaded_by").references(() => user.id, { onDelete: "set null" }),
    /** Null = kept. */
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("inbox_file_conversation_idx").on(t.conversationId), index("inbox_file_message_idx").on(t.messageId), index("inbox_file_expires_idx").on(t.expiresAt)],
);
