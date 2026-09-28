import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  decimal,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { store } from "./store";
import { order } from "./orders";
import { user } from "./auth";

export const discountTypeEnum = pgEnum("discount_type", [
  "PERCENTAGE",
  "FIXED_AMOUNT",
  "FREE_SHIPPING",
]);

export const discountConditionTypeEnum = pgEnum("discount_condition_type", [
  "SPECIFIC_PRODUCTS",
  "SPECIFIC_CATEGORIES",
  "MIN_QUANTITY",
  "CUSTOMER_GROUP",
]);

export const discount = pgTable("discount", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id")
    .notNull()
    .references(() => store.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  type: discountTypeEnum("type").notNull(),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  minPurchaseAmount: decimal("min_purchase_amount", {
    precision: 10,
    scale: 2,
  }),
  maxUsesTotal: integer("max_uses_total"),
  maxUsesPerCustomer: integer("max_uses_per_customer"),
  usedCount: integer("used_count").notNull().default(0),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const discountCondition = pgTable("discount_condition", {
  id: uuid("id").primaryKey().defaultRandom(),
  discountId: uuid("discount_id")
    .notNull()
    .references(() => discount.id, { onDelete: "cascade" }),
  type: discountConditionTypeEnum("type").notNull(),
  targetIds: text("target_ids").array().notNull(),
});

export const discountUsage = pgTable("discount_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  discountId: uuid("discount_id")
    .notNull()
    .references(() => discount.id, { onDelete: "cascade" }),
  orderId: uuid("order_id")
    .notNull()
    .references(() => order.id, { onDelete: "cascade" }),
  customerId: text("customer_id").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
