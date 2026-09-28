import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  decimal,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { product } from "./catalog";
import { store } from "./store";

export const productOption = pgTable("product_option", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => product.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const productOptionValue = pgTable("product_option_value", {
  id: uuid("id").primaryKey().defaultRandom(),
  optionId: uuid("option_id")
    .notNull()
    .references(() => productOption.id, { onDelete: "cascade" }),
  value: text("value").notNull(),
  position: integer("position").notNull().default(0),
});

export const productVariant = pgTable(
  "product_variant",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => store.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    sku: text("sku"),
    name: text("name").notNull(),
    price: decimal("price", { precision: 10, scale: 2 }),
    compareAtPrice: decimal("compare_at_price", { precision: 10, scale: 2 }),
    weight: decimal("weight", { precision: 10, scale: 2 }),
    barcode: text("barcode"),
    legacySystem: text("legacy_system"),
    legacyId: text("legacy_id"),
    sourceSnapshot: jsonb("source_snapshot").$type<Record<string, unknown>>(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("variant_store_sku_idx").on(table.storeId, table.sku),
    uniqueIndex("variant_legacy_source_idx").on(
      table.storeId,
      table.legacySystem,
      table.legacyId,
    ),
  ],
);

export const variantOptionValue = pgTable("variant_option_value", {
  variantId: uuid("variant_id")
    .notNull()
    .references(() => productVariant.id, { onDelete: "cascade" }),
  optionValueId: uuid("option_value_id")
    .notNull()
    .references(() => productOptionValue.id, { onDelete: "cascade" }),
});
