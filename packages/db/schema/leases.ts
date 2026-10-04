import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Who may edit a Studio resource right now. One row per resource
 * (`doc:<documentId>`, later `theme:<themeId>`), held by one browser tab
 * (`client_id`). The holder renews every 10 s; a lease past `expires_at`
 * (tab closed, crashed, offline) is free. `active_at` is the holder's last
 * edit: a request for control is granted without asking once that is older
 * than 60 s. Handoffs are single conditional UPDATEs.
 */
export const studioLease = pgTable(
  "studio_lease",
  {
    resource: text("resource").primaryKey(),
    siteId: uuid("site_id").notNull(),
    clientId: text("client_id").notNull(),
    userId: text("user_id").notNull(),
    userName: text("user_name").notNull(),
    acquiredAt: timestamp("acquired_at", { withTimezone: true }).notNull().defaultNow(),
    activeAt: timestamp("active_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("studio_lease_site_idx").on(t.siteId)],
);
