import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  integer,
  decimal,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
  foreignKey,
} from "drizzle-orm/pg-core";
import { site } from "./site";

export const category = pgTable(
  "category",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    image: text("image"),
    parentId: uuid("parent_id"),
    position: integer("position").notNull().default(0),
    legacySystem: text("legacy_system"),
    legacyId: text("legacy_id"),
    legacyPath: text("legacy_path"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ columns: [table.parentId], foreignColumns: [table.id], name: "category_parent_fk" }).onDelete("set null"),
    index("category_site_parent_idx").on(table.siteId, table.parentId, table.position),
    uniqueIndex("category_site_slug_idx").on(table.siteId, table.slug),
    uniqueIndex("category_legacy_source_idx").on(
      table.siteId,
      table.legacySystem,
      table.legacyId,
    ),
  ],
);

export const product = pgTable(
  "product",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),
    basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
    compareAtPrice: decimal("compare_at_price", { precision: 10, scale: 2 }),
    isArchived: boolean("is_archived").notNull().default(false),
    isFeatured: boolean("is_featured").notNull().default(false),
    isDigital: boolean("is_digital").notNull().default(false),
    weight: decimal("weight", { precision: 10, scale: 2 }),
    width: decimal("width", { precision: 10, scale: 2 }),
    height: decimal("height", { precision: 10, scale: 2 }),
    depth: decimal("depth", { precision: 10, scale: 2 }),
    brand: text("brand"),
    attributes: jsonb("attributes").$type<Record<string, unknown>>().default({}),
    legacySystem: text("legacy_system"),
    legacyId: text("legacy_id"),
    legacyPath: text("legacy_path"),
    sourceSnapshot: jsonb("source_snapshot").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("product_site_slug_idx").on(table.siteId, table.slug),
    uniqueIndex("product_legacy_source_idx").on(
      table.siteId,
      table.legacySystem,
      table.legacyId,
    ),
  ],
);

export const productImage = pgTable("product_image", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => product.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  alt: text("alt"),
  position: integer("position").notNull().default(0),
});

export const productCategory = pgTable(
  "product_category",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => category.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.categoryId] }),
    index("product_category_category_idx").on(table.categoryId),
  ],
);

export const tag = pgTable(
  "tag",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
  },
  (table) => [uniqueIndex("tag_site_slug_idx").on(table.siteId, table.slug)],
);

export const productTag = pgTable("product_tag", {
  productId: uuid("product_id")
    .notNull()
    .references(() => product.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id")
    .notNull()
    .references(() => tag.id, { onDelete: "cascade" }),
});
