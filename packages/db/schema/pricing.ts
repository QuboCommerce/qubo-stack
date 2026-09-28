import {
  boolean,
  decimal,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { product } from "./catalog";
import { store } from "./store";
import { productVariant } from "./variants";

export const customerGroup = pgTable(
  "customer_group",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => store.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    legacySystem: text("legacy_system"),
    legacyId: text("legacy_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("customer_group_store_slug_idx").on(table.storeId, table.slug),
  ],
);

export const customerGroupMember = pgTable(
  "customer_group_member",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => customerGroup.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("customer_group_member_idx").on(table.groupId, table.userId),
  ],
);

export const priceList = pgTable(
  "price_list",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => store.id, { onDelete: "cascade" }),
    customerGroupId: uuid("customer_group_id").references(
      () => customerGroup.id,
      { onDelete: "set null" },
    ),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    currency: text("currency").notNull().default("EUR"),
    includesTax: boolean("includes_tax").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    startsAt: timestamp("starts_at"),
    endsAt: timestamp("ends_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("price_list_store_slug_idx").on(table.storeId, table.slug),
  ],
);

export const priceListPrice = pgTable(
  "price_list_price",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    priceListId: uuid("price_list_id")
      .notNull()
      .references(() => priceList.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => product.id, {
      onDelete: "cascade",
    }),
    variantId: uuid("variant_id").references(() => productVariant.id, {
      onDelete: "cascade",
    }),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("price_list_product_idx").on(table.priceListId, table.productId),
    uniqueIndex("price_list_variant_idx").on(table.priceListId, table.variantId),
  ],
);
