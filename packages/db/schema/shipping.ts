import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  decimal,
  pgEnum,
} from "drizzle-orm/pg-core";
import { site } from "./site";
import { order } from "./orders";

export const shippingRateTypeEnum = pgEnum("shipping_rate_type", [
  "FLAT",
  "WEIGHT_BASED",
  "PRICE_BASED",
  "FREE",
]);

export const shipmentStatusEnum = pgEnum("shipment_status", [
  "PENDING",
  "SHIPPED",
  "IN_TRANSIT",
  "DELIVERED",
  "FAILED",
]);

export const shippingZone = pgTable("shipping_zone", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id")
    .notNull()
    .references(() => site.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  countries: text("countries").array().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const shippingRate = pgTable("shipping_rate", {
  id: uuid("id").primaryKey().defaultRandom(),
  zoneId: uuid("zone_id")
    .notNull()
    .references(() => shippingZone.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  type: shippingRateTypeEnum("type").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0"),
  minWeight: decimal("min_weight", { precision: 10, scale: 2 }),
  maxWeight: decimal("max_weight", { precision: 10, scale: 2 }),
  minOrderAmount: decimal("min_order_amount", { precision: 10, scale: 2 }),
  maxOrderAmount: decimal("max_order_amount", { precision: 10, scale: 2 }),
  estimatedDaysMin: integer("estimated_days_min"),
  estimatedDaysMax: integer("estimated_days_max"),
});

export const shipment = pgTable("shipment", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => order.id, { onDelete: "cascade" }),
  shippingRateId: uuid("shipping_rate_id").references(() => shippingRate.id, {
    onDelete: "set null",
  }),
  trackingNumber: text("tracking_number"),
  carrier: text("carrier"),
  status: shipmentStatusEnum("status").notNull().default("PENDING"),
  shippedAt: timestamp("shipped_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
