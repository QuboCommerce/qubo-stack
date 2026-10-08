import { boolean, doublePrecision, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Device + geo for a Better Auth `session` (1:1 by `session_id`). No FK on
 * purpose: Better Auth deletes the session row on sign-out/revoke, and this row
 * must outlive it so the ended tab can learn why ("logged in elsewhere").
 * Rows ended more than 30 days ago are pruned.
 */
export const sessionDevice = pgTable(
  "session_device",
  {
    sessionId: text("session_id").primaryKey(),
    userId: text("user_id").notNull(),
    /** sha256(session token): lets a request with a dead cookie find its revoke reason. */
    tokenHash: text("token_hash").notNull().unique(),
    deviceLabel: text("device_label").notNull(),
    browser: text("browser"),
    os: text("os"),
    ip: text("ip"),
    city: text("city"),
    region: text("region"),
    country: text("country"),
    countryCode: text("country_code"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    isLocal: boolean("is_local").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
    lastFocusedAt: timestamp("last_focused_at", { withTimezone: true }),
    isFocused: boolean("is_focused").notNull().default(false),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    /** signed_out | takeover | revoked | expired */
    revokedReason: text("revoked_reason"),
    /** The session that ended this one (takeover / revoke from another device). */
    endedBySessionId: text("ended_by_session_id"),
  },
  (t) => [index("session_device_user_idx").on(t.userId, t.lastActiveAt)],
);
