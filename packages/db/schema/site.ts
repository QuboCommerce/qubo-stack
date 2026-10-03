import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const organizationRoleEnum = pgEnum("organization_role", [
  "OWNER",
  "ADMIN",
  "STAFF",
  "VIEWER",
]);

export const organization = pgTable("organization", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const organizationMember = pgTable(
  "organization_member",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: organizationRoleEnum("role").notNull().default("STAFF"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("organization_member_org_user_idx").on(
      table.organizationId,
      table.userId,
    ),
  ],
);

/**
 * A Site's type is the preset it was created from: it seeds capabilities,
 * system templates and the default flavor. Capabilities stay individually
 * toggleable afterwards, so the type never gates features on its own.
 */
export const siteTypeEnum = pgEnum("site_type", [
  "store",
  "services",
  "business",
  "editorial",
  "custom",
]);

/** Feature switches; keep in sync with `capabilities` in @qubo/blocks. */
export const siteCapabilityEnum = pgEnum("site_capability", [
  "commerce",
  "catalog",
  "booking",
  "leads",
  "blog",
  "accounts",
  "locales",
]);

export const site = pgTable("site", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  type: siteTypeEnum("type").notNull().default("store"),
  capabilities: siteCapabilityEnum("capabilities").array().notNull().default([]),
  description: text("description"),
  logo: text("logo"),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  currency: text("currency").notNull().default("EUR"),
  locale: text("locale").notNull().default("fr-BE"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const siteDomain = pgTable("site_domain", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id")
    .notNull()
    .references(() => site.id, { onDelete: "cascade" }),
  hostname: text("hostname").notNull().unique(),
  isPrimary: boolean("is_primary").notNull().default(false),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const siteSettings = pgTable("site_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id")
    .notNull()
    .unique()
    .references(() => site.id, { onDelete: "cascade" }),
  maintenanceMode: boolean("maintenance_mode").notNull().default(false),
  maintenanceMessage: text("maintenance_message"),
  maintenanceEnd: timestamp("maintenance_end"),
  timezone: text("timezone").notNull().default("Europe/Brussels"),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
