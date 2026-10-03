import { bigserial, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Durable platform events (@qubo/realtime). Insert + NOTIFY qubo_events '<id>';
 * listeners load the row. Pruned after 7 days.
 */
export const platformEvent = pgTable(
  "platform_event",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    type: text("type").notNull(),
    siteId: text("site_id"),
    orgId: text("org_id"),
    userId: text("user_id"),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("platform_event_site_idx").on(t.siteId, t.id), index("platform_event_created_idx").on(t.createdAt)],
);
