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
import { store } from "./store";

export const storeCustomer = pgTable(
  "store_customer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => store.id, { onDelete: "cascade" }),
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
    uniqueIndex("store_customer_email_idx").on(table.storeId, table.email),
    uniqueIndex("store_customer_legacy_idx").on(
      table.storeId,
      table.legacySystem,
      table.legacyId,
    ),
  ],
);
