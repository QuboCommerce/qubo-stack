import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  decimal,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { site } from "./site";
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

/** A code typed in the cart. Codes are stored uppercase and are unique per site. */
export const discount = pgTable(
  "discount",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    /** Internal label, never shown to shoppers. */
    name: text("name"),
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
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedById: text("updated_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("discount_site_code_idx").on(table.siteId, sql`upper(${table.code})`),
  ],
);

export const discountCondition = pgTable(
  "discount_condition",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    discountId: uuid("discount_id")
      .notNull()
      .references(() => discount.id, { onDelete: "cascade" }),
    type: discountConditionTypeEnum("type").notNull(),
    targetIds: text("target_ids").array().notNull(),
  },
  (table) => [index("discount_condition_discount_idx").on(table.discountId)],
);

export const discountUsage = pgTable(
  "discount_usage",
  {
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
  },
  (table) => [
    uniqueIndex("discount_usage_order_idx").on(table.discountId, table.orderId),
    index("discount_usage_customer_idx").on(table.discountId, table.customerId),
  ],
);
