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

/**
 * One organisation = one legal entity (its own VAT number, invoices, customers and GDPR
 * controller). Sites are brands/storefronts of that entity. Never put two companies in one org.
 */
export const organization = pgTable("organization", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Display name in the admin, e.g. "TLG Belgium". */
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  /** As registered, e.g. "TLG-BELGIUM" (KBO/BCE in Belgium). Used on invoices and legal pages. */
  legalName: text("legal_name"),
  legalForm: text("legal_form"),
  /** National company number, e.g. Belgian enterprise number 0655.678.923. */
  companyNumber: text("company_number"),
  vatNumber: text("vat_number"),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  postalCode: text("postal_code"),
  city: text("city"),
  /** ISO 3166-1 alpha-2. */
  country: text("country"),
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
  /**
   * First publish; null = draft. Drafts are only reachable by staff and on the
   * PIN-locked preview host, and can move between organisations. Once set it
   * never clears: the site belongs to its organisation for good (orders,
   * invoices, customers). Taking a site offline is maintenance mode.
   */
  publishedAt: timestamp("published_at"),
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
  /** Unlocks `preview.<domain>` (draft storefront). Regenerating it logs every previewer out. */
  previewPin: text("preview_pin"),
  timezone: text("timezone").notNull().default("Europe/Brussels"),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
