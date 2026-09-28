import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
} from "drizzle-orm/pg-core";
import { store } from "./store";
import { user } from "./auth";

export const postStatusEnum = pgEnum("post_status", [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
]);

export const blogCategory = pgTable("blog_category", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id")
    .notNull()
    .references(() => store.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const post = pgTable("post", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id")
    .notNull()
    .references(() => store.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  content: text("content"),
  excerpt: text("excerpt"),
  coverImage: text("cover_image"),
  status: postStatusEnum("status").notNull().default("DRAFT"),
  publishedAt: timestamp("published_at"),
  authorId: text("author_id").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const postCategory = pgTable("post_category", {
  postId: uuid("post_id")
    .notNull()
    .references(() => post.id, { onDelete: "cascade" }),
  blogCategoryId: uuid("blog_category_id")
    .notNull()
    .references(() => blogCategory.id, { onDelete: "cascade" }),
});
