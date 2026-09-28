import {
  pgTable,
  text,
  timestamp,
  uuid,
  decimal,
  pgEnum,
} from "drizzle-orm/pg-core";
import { order } from "./orders";

export const paymentProcessorEnum = pgEnum("payment_processor", [
  "STRIPE",
  "MANUAL",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "CARD",
  "BANCONTACT",
  "BANK_TRANSFER",
  "BNPL",
  "CASH_ON_DELIVERY",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "PENDING",
  "COMPLETED",
  "FAILED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
]);

export const payment = pgTable("payment", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => order.id, { onDelete: "cascade" }),
  processor: paymentProcessorEnum("processor").notNull(),
  processorId: text("processor_id"),
  method: paymentMethodEnum("method").notNull(),
  status: paymentStatusEnum("status").notNull().default("PENDING"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("EUR"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const refundStatusEnum = pgEnum("refund_status", [
  "PENDING",
  "COMPLETED",
  "FAILED",
]);

export const refund = pgTable("refund", {
  id: uuid("id").primaryKey().defaultRandom(),
  paymentId: uuid("payment_id")
    .notNull()
    .references(() => payment.id, { onDelete: "cascade" }),
  orderId: uuid("order_id")
    .notNull()
    .references(() => order.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason"),
  status: refundStatusEnum("status").notNull().default("PENDING"),
  processorRefundId: text("processor_refund_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
