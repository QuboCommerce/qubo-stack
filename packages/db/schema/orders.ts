import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  decimal,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";
import { store } from "./store";
import { user } from "./auth";
import { productVariant } from "./variants";
import { address } from "./addresses";

export const orderStatusEnum = pgEnum("order_status", [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
]);

export const order = pgTable("order", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id")
    .notNull()
    .references(() => store.id, { onDelete: "cascade" }),
  customerId: text("customer_id").references(() => user.id, {
    onDelete: "set null",
  }),
  customerEmail: text("customer_email"),
  customerName: text("customer_name"),
  orderNumber: text("order_number").notNull().unique(),
  status: orderStatusEnum("status").notNull().default("PENDING"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  taxTotal: decimal("tax_total", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  shippingTotal: decimal("shipping_total", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  discountTotal: decimal("discount_total", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("EUR"),
  notes: text("notes"),
  shippingAddressId: uuid("shipping_address_id").references(() => address.id, {
    onDelete: "set null",
  }),
  billingAddressId: uuid("billing_address_id").references(() => address.id, {
    onDelete: "set null",
  }),
  shippingAddress: jsonb("shipping_address").$type<Record<string, unknown>>(),
  billingAddress: jsonb("billing_address").$type<Record<string, unknown>>(),
  cancelledAt: timestamp("cancelled_at"),
  cancelReason: text("cancel_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const orderItem = pgTable("order_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => order.id, { onDelete: "cascade" }),
  variantId: uuid("variant_id").references(() => productVariant.id, {
    onDelete: "set null",
  }),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  productName: text("product_name").notNull(),
  variantName: text("variant_name"),
  sku: text("sku"),
  imageUrl: text("image_url"),
});

export const orderStatusHistory = pgTable("order_status_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => order.id, { onDelete: "cascade" }),
  fromStatus: orderStatusEnum("from_status"),
  toStatus: orderStatusEnum("to_status").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by").references(() => user.id, {
    onDelete: "set null",
  }),
});
