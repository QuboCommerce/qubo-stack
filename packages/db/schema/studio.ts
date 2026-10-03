import {
  boolean,
  index,
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
import { organization, site } from "./site";

/**
 * Qubo Studio storage. Every editable surface (template, page, section
 * group, linked section) is a `document`: a Puck block tree with a draft and a
 * published copy. Publishing appends an immutable `document_revision`, so any
 * publish can be rolled back. Undo/redo is client-only and never persisted.
 */

export const documentKindEnum = pgEnum("document_kind", [
  "template",
  "page",
  "section_group",
  "linked_section",
]);

export const revisionKindEnum = pgEnum("revision_kind", [
  "publish",
  "checkpoint",
  "autosave",
]);

export const document = pgTable(
  "document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "cascade" }),
    kind: documentKindEnum("kind").notNull(),
    /** Latest saved editor state. */
    draftData: jsonb("draft_data").notNull(),
    /** Optimistic concurrency: saves must send the version they started from. */
    draftVersion: integer("draft_version").notNull().default(1),
    /** What storefronts render. Null until the first publish. */
    publishedData: jsonb("published_data"),
    publishedRevisionId: uuid("published_revision_id"),
    publishedAt: timestamp("published_at"),
    updatedById: text("updated_by_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("document_site_kind_idx").on(t.siteId, t.kind)],
);

export const documentRevision = pgTable(
  "document_revision",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    kind: revisionKindEnum("kind").notNull().default("publish"),
    data: jsonb("data").notNull(),
    label: text("label"),
    createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("document_revision_doc_version_idx").on(t.documentId, t.version)],
);

/**
 * What a template renders. System templates (404, password, maintenance…)
 * can't be deleted and show a lock in the Studio view picker.
 */
export const resourceKindEnum = pgEnum("resource_kind", [
  "home",
  "page",
  "product",
  "collection",
  "collection_list",
  "cart",
  "search",
  "service",
  "booking",
  "blog",
  "article",
  "account",
  "not_found",
  "password",
  "maintenance",
]);

export const template = pgTable(
  "template",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "cascade" }),
    resourceKind: resourceKindEnum("resource_kind").notNull(),
    /** `default` or an alternate name, e.g. product.`refrigerated-display`. */
    handle: text("handle").notNull().default("default"),
    name: text("name").notNull(),
    isSystem: boolean("is_system").notNull().default(false),
    documentId: uuid("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("template_site_kind_handle_idx").on(t.siteId, t.resourceKind, t.handle)],
);

export const sectionGroupKindEnum = pgEnum("section_group_kind", ["header", "footer", "overlay"]);

/** Header / footer / overlay groups shared by every template (Shopify's section groups). */
export const sectionGroup = pgTable(
  "section_group",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "cascade" }),
    kind: sectionGroupKindEnum("kind").notNull(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("section_group_site_kind_idx").on(t.siteId, t.kind)],
);

/** A reusable section placed on many documents; editing it updates all of them. */
export const linkedSection = pgTable("linked_section", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id")
    .notNull()
    .references(() => site.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => document.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** A merchant-saved starting point for a block ("Save as preset"). */
export const sectionPreset = pgTable("section_preset", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id")
    .notNull()
    .references(() => site.id, { onDelete: "cascade" }),
  blockType: text("block_type").notNull(),
  name: text("name").notNull(),
  props: jsonb("props").notNull(),
  createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ------------------------------------------------------------------ themes ---

/** A StyleKit theme. `draft`/`published` hold `ThemeInput` JSON; one active theme per site. */
export const theme = pgTable(
  "theme",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    draft: jsonb("draft").notNull(),
    draftVersion: integer("draft_version").notNull().default(1),
    published: jsonb("published"),
    publishedAt: timestamp("published_at"),
    /** Palette Doctor scores cached at save time, for list badges. */
    health: integer("health"),
    richness: text("richness"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("theme_site_idx").on(t.siteId)],
);

export const themeRevision = pgTable(
  "theme_revision",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    themeId: uuid("theme_id")
      .notNull()
      .references(() => theme.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    data: jsonb("data").notNull(),
    label: text("label"),
    createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("theme_revision_theme_version_idx").on(t.themeId, t.version)],
);

// ------------------------------------------------------------------- media ---

/**
 * Media lives at the organization level so a merchant with two sites shares
 * one library; `siteId` null = shared pool. Object key in Supabase Storage:
 * `{orgId}/{siteId|shared}/{assetId}.{ext}` in the `media` bucket.
 */
export const asset = pgTable(
  "asset",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").references(() => site.id, { onDelete: "set null" }),
    bucket: text("bucket").notNull().default("media"),
    key: text("key").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    duration: integer("duration"),
    /** Default alt text; blocks may override per placement. */
    alt: text("alt").notNull().default(""),
    /** Tiny blurred placeholder (data URI) for progressive loading. */
    blurhash: text("blurhash"),
    folder: text("folder"),
    createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("asset_bucket_key_idx").on(t.bucket, t.key),
    index("asset_org_site_idx").on(t.organizationId, t.siteId),
  ],
);

export const assetTag = pgTable(
  "asset_tag",
  {
    assetId: uuid("asset_id")
      .notNull()
      .references(() => asset.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
  },
  (t) => [uniqueIndex("asset_tag_pk").on(t.assetId, t.tag), index("asset_tag_tag_idx").on(t.tag)],
);

/** Where an asset is used, so deleting it can warn ("used on 3 pages"). */
export const assetUsage = pgTable(
  "asset_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => asset.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => document.id, { onDelete: "cascade" }),
    /** Non-document owners, e.g. `product:<id>`, `theme:<id>`. */
    ownerRef: text("owner_ref"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("asset_usage_asset_idx").on(t.assetId), index("asset_usage_document_idx").on(t.documentId)],
);

export const fontSourceEnum = pgEnum("font_source", ["upload", "google-selfhosted", "system"]);

/** Organization font library; themes reference fonts by id. */
export const font = pgTable(
  "font",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    family: text("family").notNull(),
    source: fontSourceEnum("source").notNull().default("upload"),
    /** `[{ assetId, weight, style }]` */
    files: jsonb("files").notNull().default([]),
    fallback: text("fallback").notNull().default("system-ui, sans-serif"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("font_org_family_idx").on(t.organizationId, t.family)],
);

// ---------------------------------------------------------------- locales ---

export const siteLocale = pgTable(
  "site_locale",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    isPublished: boolean("is_published").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("site_locale_site_locale_idx").on(t.siteId, t.locale)],
);

export const translationStatusEnum = pgEnum("translation_status", ["missing", "draft", "done", "stale"]);

/**
 * Per-field translation overlay. `path` addresses a translatable leaf inside
 * a document (`<nodeId>.header.title`). `sourceHash` marks translations stale
 * when the primary-language text changes.
 */
export const translation = pgTable(
  "translation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "cascade" }),
    /** `document:<id>`, `product:<id>`, `navigation:<id>`… */
    ownerRef: text("owner_ref").notNull(),
    path: text("path").notNull(),
    locale: text("locale").notNull(),
    value: text("value").notNull(),
    sourceHash: text("source_hash").notNull(),
    status: translationStatusEnum("status").notNull().default("draft"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("translation_owner_path_locale_idx").on(t.ownerRef, t.path, t.locale)],
);

// ---------------------------------------------------------- content types ---

/** Merchant-defined structured content (Shopify metaobjects): team members, FAQs, services… */
export const contentType = pgTable(
  "content_type",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "cascade" }),
    handle: text("handle").notNull(),
    name: text("name").notNull(),
    /** Field definitions (same `f.*` vocabulary as blocks, serialised). */
    fields: jsonb("fields").notNull().default([]),
    /** Entries get their own URL + template (e.g. /services/:handle). */
    isRoutable: boolean("is_routable").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("content_type_site_handle_idx").on(t.siteId, t.handle)],
);

export const contentEntry = pgTable(
  "content_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contentTypeId: uuid("content_type_id")
      .notNull()
      .references(() => contentType.id, { onDelete: "cascade" }),
    handle: text("handle").notNull(),
    values: jsonb("values").notNull().default({}),
    isPublished: boolean("is_published").notNull().default(false),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("content_entry_type_handle_idx").on(t.contentTypeId, t.handle)],
);

// ------------------------------------------------------------------ forms ---

/** Lead-gen forms; blocks post to `/api/forms/:key`. */
export const form = pgTable(
  "form",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    notifyEmails: text("notify_emails").array().notNull().default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("form_site_key_idx").on(t.siteId, t.key)],
);

export const formSubmissionStatusEnum = pgEnum("form_submission_status", ["new", "read", "archived", "spam"]);

export const formSubmission = pgTable(
  "form_submission",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    formId: uuid("form_id")
      .notNull()
      .references(() => form.id, { onDelete: "cascade" }),
    data: jsonb("data").notNull(),
    status: formSubmissionStatusEnum("status").notNull().default("new"),
    pagePath: text("page_path"),
    locale: text("locale"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("form_submission_form_created_idx").on(t.formId, t.createdAt)],
);
