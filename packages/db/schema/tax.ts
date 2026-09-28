import {
  pgTable,
  text,
  timestamp,
  uuid,
  decimal,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { store } from "./store";

export const taxZone = pgTable("tax_zone", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id")
    .notNull()
    .references(() => store.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  country: text("country").notNull(),
  state: text("state"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const taxRate = pgTable("tax_rate", {
  id: uuid("id").primaryKey().defaultRandom(),
  zoneId: uuid("zone_id")
    .notNull()
    .references(() => taxZone.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  rate: decimal("rate", { precision: 5, scale: 2 }).notNull(),
  isCompound: boolean("is_compound").notNull().default(false),
  priority: integer("priority").notNull().default(0),
  appliesToShipping: boolean("applies_to_shipping").notNull().default(false),
});
