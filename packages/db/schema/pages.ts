import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { store } from "./store";

export const publishStateEnum = pgEnum("publish_state", [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
]);

/**
 * Pages are stored as versioned Puck block JSON, never as generated React
 * source. Rendering merchant-authored code in the panel or on a storefront
 * would be a security and deployment hazard; a validated block tree is data,
 * so it can be diffed, rolled back and localized.
 */
export const page = pgTable(
  "page",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => store.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    locale: text("locale").notNull().default("fr-BE"),
    state: publishStateEnum("state").notNull().default("DRAFT"),

    /** The currently published block tree. Null until first publish. */
    publishedData: jsonb("published_data"),
    /** Work in progress, promoted to publishedData on publish. */
    draftData: jsonb("draft_data"),

    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),
    isHomepage: boolean("is_homepage").notNull().default(false),

    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // Same slug may exist per locale, but not twice within one store+locale.
    uniqueIndex("page_store_locale_slug_idx").on(
      table.storeId,
      table.locale,
      table.slug,
    ),
  ],
);

/** Append-only history so any publish can be rolled back. */
export const pageRevision = pgTable(
  "page_revision",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => page.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    data: jsonb("data").notNull(),
    label: text("label"),
    createdById: text("created_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("page_revision_page_version_idx").on(
      table.pageId,
      table.version,
    ),
  ],
);

export const navigation = pgTable(
  "navigation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => store.id, { onDelete: "cascade" }),
    handle: text("handle").notNull(),
    locale: text("locale").notNull().default("fr-BE"),
    items: jsonb("items").notNull().default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("navigation_store_locale_handle_idx").on(
      table.storeId,
      table.locale,
      table.handle,
    ),
  ],
);

/**
 * Legacy URL preservation. The ShopApplication site has ~3000 indexed URLs;
 * losing them at cutover would cost the SEO this migration is meant to protect.
 */
export const redirect = pgTable(
  "redirect",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => store.id, { onDelete: "cascade" }),
    fromPath: text("from_path").notNull(),
    toPath: text("to_path").notNull(),
    statusCode: integer("status_code").notNull().default(301),
    legacySystem: text("legacy_system"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("redirect_store_from_idx").on(table.storeId, table.fromPath),
  ],
);
