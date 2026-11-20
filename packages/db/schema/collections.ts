import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { site } from "./site";
import { product } from "./catalog";
import { user } from "./auth";
import type { CollectionRule } from "../src/collection-rules";

/**
 * A named group of products with its own storefront page at `/collections/<slug>`.
 * `smart` collections match `rules` (see `@qubo/db/collection-rules`); `manual` ones list
 * `collection_product` rows. A category with the same slug wins on the storefront.
 */
export const collection = pgTable(
  "collection",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    image: text("image"),
    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),
    kind: text("kind").$type<"smart" | "manual">().notNull().default("smart"),
    /** Smart only: every rule must hold (`all`) or at least one (`any`). */
    match: text("match").$type<"all" | "any">().notNull().default("all"),
    rules: jsonb("rules").$type<CollectionRule[]>().notNull().default([]),
    sort: text("sort").$type<"featured" | "newest" | "name" | "price_asc" | "price_desc" | "manual">().notNull().default("featured"),
    isPublished: boolean("is_published").notNull().default(false),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedById: text("updated_by_id").references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [
    uniqueIndex("collection_site_slug_idx").on(table.siteId, table.slug),
    index("collection_site_position_idx").on(table.siteId, table.position),
  ],
);

export const collectionProduct = pgTable(
  "collection_product",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collection.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.collectionId, table.productId] }),
    index("collection_product_product_idx").on(table.productId),
  ],
);
