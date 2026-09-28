import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { productVariant } from "./variants";
import { user } from "./auth";

export const inventoryReasonEnum = pgEnum("inventory_reason", [
  "SALE",
  "RESTOCK",
  "RETURN",
  "ADJUSTMENT",
  "RESERVED",
  "UNRESERVED",
]);

export const inventoryItem = pgTable("inventory_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  variantId: uuid("variant_id")
    .notNull()
    .unique()
    .references(() => productVariant.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(0),
  reservedQuantity: integer("reserved_quantity").notNull().default(0),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
  tracked: boolean("tracked").notNull().default(true),
  supplier: text("supplier"),
  storageLocation: text("storage_location"),
  legacySystem: text("legacy_system"),
  legacyId: text("legacy_id"),
  legacyStockedAt: timestamp("legacy_stocked_at"),
});

export const inventoryHistory = pgTable("inventory_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  inventoryItemId: uuid("inventory_item_id")
    .notNull()
    .references(() => inventoryItem.id, { onDelete: "cascade" }),
  adjustment: integer("adjustment").notNull(),
  reason: inventoryReasonEnum("reason").notNull(),
  referenceId: text("reference_id"),
  referenceType: text("reference_type"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by").references(() => user.id, {
    onDelete: "set null",
  }),
});
