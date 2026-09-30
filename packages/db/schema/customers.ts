import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { site } from "./site";

export const siteCustomer = pgTable(
  "site_customer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    email: text("email").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    phone: text("phone"),
    company: text("company"),
    vatNumber: text("vat_number"),
    acceptsMarketing: boolean("accepts_marketing").notNull().default(false),
    legacySystem: text("legacy_system"),
    legacyId: text("legacy_id"),
    sourceSnapshot: jsonb("source_snapshot").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("site_customer_email_idx").on(table.siteId, table.email),
    uniqueIndex("site_customer_legacy_idx").on(
      table.siteId,
      table.legacySystem,
      table.legacyId,
    ),
  ],
);
