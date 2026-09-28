import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const addressTypeEnum = pgEnum("address_type", [
  "SHIPPING",
  "BILLING",
]);

export const address = pgTable("address", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: text("customer_id").references(() => user.id, {
    onDelete: "cascade",
  }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  company: text("company"),
  line1: text("line1").notNull(),
  line2: text("line2"),
  city: text("city").notNull(),
  state: text("state"),
  postalCode: text("postal_code").notNull(),
  country: text("country").notNull(),
  phone: text("phone"),
  isDefault: boolean("is_default").notNull().default(false),
  type: addressTypeEnum("type").notNull().default("SHIPPING"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
