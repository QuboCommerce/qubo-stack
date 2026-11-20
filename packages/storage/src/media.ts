import { db } from "@qubo/db/client";
import { createHash } from "node:crypto";
import { asset, assetTag, assetUsage, document, page, product, productImage, productVariant } from "@qubo/db/schema";
import { and, asc, count, desc, eq, ilike, inArray, isNull, like, lt, not, notLike, or, sql, type SQL } from "drizzle-orm";
import { assetIdFromUrl, checkFile, cleanFilename, mediaKey, mediaUrl, problemMessage, type FileKind } from "./index";
import { dimensions, storage } from "./server";

/**
 * Media library. Assets belong to an organisation (the business); `siteId`
 * says which site uploaded it, null = shared by every site of the org.
 */

export type MediaScope = "here" | "site" | "shared" | "all";

/**
 * A lens is a filter over the pool. Grouping comes from what uses a file
 * (product galleries, pages, the theme, blog covers), never from tags, so it
 * cannot drift. Scratch is whatever nothing uses and nobody tagged.
 */
export const MEDIA_LENSES = ["all", "scratch", "products", "pages", "design", "blog", "documents"] as const;
export type MediaLens = (typeof MEDIA_LENSES)[number];

export type MediaItem = {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  kind: FileKind;
  size: number;
  width: number | null;
  height: number | null;
  alt: string;
  siteId: string | null;
  tags: string[];
  createdAt: string;
};

const kindOf = (mime: string): FileKind => (mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : "document");
const extOfKey = (key: string) => key.slice(key.lastIndexOf(".") + 1);

export const toMediaItem = (a: typeof asset.$inferSelect, tags: string[] = []): MediaItem => ({
  id: a.id,
  url: mediaUrl(a.organizationId, a.id, extOfKey(a.key)),
  filename: a.filename,
  mimeType: a.mimeType,
  kind: kindOf(a.mimeType),
  size: a.size,
  width: a.width,
  height: a.height,
  alt: a.alt,
  siteId: a.siteId,
  tags,
  createdAt: a.createdAt.toISOString(),
});

/** `duplicate`: the same bytes were already in the library, so that file is returned instead. */
export type UploadResult = { ok: true; item: MediaItem; duplicate?: boolean } | { ok: false; error: string };

export async function uploadAsset(input: { orgId: string; siteId: string | null; userId: string; filename: string; bytes: Uint8Array; alt?: string }): Promise<UploadResult> {
  const filename = cleanFilename(input.filename);
  const checked = checkFile("media", filename, input.bytes);
  if (!checked.ok) return { ok: false, error: problemMessage(checked.problem, filename, "media") };
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const [same] = await db.select().from(asset).where(and(eq(asset.organizationId, input.orgId), eq(asset.sha256, sha256))).limit(1);
  if (same) return { ok: true, item: (await withTags([same]))[0]!, duplicate: true };
  const id = crypto.randomUUID();
  const key = mediaKey(input.orgId, id, checked.file.ext);
  await storage().put(key, input.bytes, checked.file.mime);
  const dims = checked.file.kind === "image" ? dimensions(input.bytes) : null;
  const [row] = await db
    .insert(asset)
    .values({
      id,
      organizationId: input.orgId,
      siteId: input.siteId,
      key,
      filename,
      mimeType: checked.file.mime,
      size: input.bytes.byteLength,
      width: dims?.width ?? null,
      height: dims?.height ?? null,
      alt: input.alt?.trim().slice(0, 300) ?? "",
      sha256,
      createdById: input.userId,
    })
    .returning();
  return { ok: true, item: toMediaItem(row!) };
}

function scopeFilter(scope: MediaScope, siteId: string): SQL | undefined {
  switch (scope) {
    case "here":
      return or(eq(asset.siteId, siteId), isNull(asset.siteId));
    case "site":
      return eq(asset.siteId, siteId);
    case "shared":
      return isNull(asset.siteId);
    case "all":
      return undefined;
  }
}

// Raw "asset"."id" on purpose: in a single-table select Drizzle renders ${asset.id} unqualified,
// which would bind to the inner table's id inside these subqueries.
const inGallery = sql`exists (select 1 from "product_image" pi where pi."asset_id" = "asset"."id")`;
const onPages = (kind: "page" | "layout") =>
  sql`exists (select 1 from "asset_usage" u join "document" d on d."id" = u."document_id" where u."asset_id" = "asset"."id" and ${sql.raw(kind === "page" ? `d."kind" = 'page'` : `d."kind" <> 'page'`)})`;
const inTheme = sql`exists (select 1 from "theme" t join "site" s on s."id" = t."site_id" where s."organization_id" = "asset"."organization_id"
  and jsonb_path_exists(jsonb_build_array(t."draft"->'brand', t."published"->'brand'), '$.**.assetId ? (@ == $id)', jsonb_build_object('id', "asset"."id"::text)))`;
const asCover = sql`exists (select 1 from "post" po join "site" s on s."id" = po."site_id" where s."organization_id" = "asset"."organization_id"
  and po."cover_image" like '%/' || "asset"."id"::text || '.%')`;
const tagged = sql`exists (select 1 from "asset_tag" t where t."asset_id" = "asset"."id")`;
const anyUsage = sql`exists (select 1 from "asset_usage" u where u."asset_id" = "asset"."id")`;

const isDocument = and(notLike(asset.mimeType, "image/%"), notLike(asset.mimeType, "video/%"));

function lensFilter(lens: MediaLens): SQL | undefined {
  switch (lens) {
    case "all":
      return undefined;
    case "scratch":
      return not(or(inGallery, anyUsage, inTheme, asCover, tagged)!);
    case "products":
      return inGallery;
    case "pages":
      return onPages("page");
    case "design":
      return or(inTheme, onPages("layout"));
    case "blog":
      return asCover;
    case "documents":
      return isDocument;
  }
}

/** Escapes LIKE wildcards in user input. */
const likeSafe = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function listAssets(input: {
  orgId: string;
  siteId: string;
  scope: MediaScope;
  lens?: MediaLens;
  tag?: string;
  q?: string;
  kind?: FileKind;
  before?: string;
  limit?: number;
}) {
  const limit = Math.min(input.limit ?? 60, 200);
  const q = input.q?.trim() ? likeSafe(input.q.trim()) : undefined;
  const kind = input.kind ? (input.kind === "document" ? isDocument : like(asset.mimeType, `${input.kind}/%`)) : undefined;
  const rows = await db
    .select()
    .from(asset)
    .where(
      and(
        eq(asset.organizationId, input.orgId),
        scopeFilter(input.scope, input.siteId),
        lensFilter(input.lens ?? "all"),
        input.tag ? sql`exists (select 1 from "asset_tag" t where t."asset_id" = "asset"."id" and t."tag" = ${input.tag})` : undefined,
        q
          ? or(ilike(asset.filename, `%${q}%`), ilike(asset.alt, `%${q}%`), sql`exists (select 1 from "asset_tag" t where t."asset_id" = "asset"."id" and t."tag" ilike ${`%${q}%`})`)
          : undefined,
        kind,
        input.before ? lt(asset.createdAt, new Date(input.before)) : undefined,
      ),
    )
    .orderBy(desc(asset.createdAt))
    .limit(limit + 1);
  return { items: await withTags(rows.slice(0, limit)), more: rows.length > limit };
}

async function withTags(rows: (typeof asset.$inferSelect)[]) {
  if (!rows.length) return [];
  const tags = await db
    .select({ assetId: assetTag.assetId, tag: assetTag.tag })
    .from(assetTag)
    .where(inArray(assetTag.assetId, rows.map((r) => r.id)))
    .orderBy(asc(assetTag.tag));
  const by = Map.groupBy(tags, (t) => t.assetId);
  return rows.map((r) => toMediaItem(r, by.get(r.id)?.map((t) => t.tag) ?? []));
}

export async function getAsset(orgId: string, id: string) {
  const row = await db.query.asset.findFirst({ where: and(eq(asset.id, id), eq(asset.organizationId, orgId)) });
  return row ? ((await withTags([row]))[0] ?? null) : null;
}

export async function updateAsset(orgId: string, id: string, patch: { alt?: string; filename?: string; siteId?: string | null }) {
  const set: Partial<typeof asset.$inferInsert> = {};
  if (patch.alt !== undefined) set.alt = patch.alt.trim().slice(0, 300);
  if (patch.filename !== undefined) set.filename = cleanFilename(patch.filename);
  if (patch.siteId !== undefined) set.siteId = patch.siteId;
  const [row] = await db.update(asset).set(set).where(and(eq(asset.id, id), eq(asset.organizationId, orgId))).returning();
  return row ? ((await withTags([row]))[0] ?? null) : null;
}

/** Where an asset is used: page documents (usage rows) and product galleries (`product_image.asset_id`). */
export async function assetUsages(ids: string[]) {
  type Usage = { documents: { id: string; title: string | null }[]; products: { id: string; name: string }[] };
  const out = new Map<string, Usage>();
  if (!ids.length) return out;
  const [docs, products] = await Promise.all([
    db
      .select({ assetId: assetUsage.assetId, documentId: assetUsage.documentId, title: page.title, kind: document.kind })
      .from(assetUsage)
      .innerJoin(document, eq(document.id, assetUsage.documentId))
      .leftJoin(page, eq(page.documentId, assetUsage.documentId))
      .where(inArray(assetUsage.assetId, ids)),
    db
      .selectDistinct({ assetId: productImage.assetId, id: product.id, name: product.name })
      .from(productImage)
      .innerJoin(product, eq(product.id, productImage.productId))
      .where(inArray(productImage.assetId, ids)),
  ]);
  const get = (id: string) => out.get(id) ?? (out.set(id, { documents: [], products: [] }), out.get(id)!);
  for (const r of docs) get(r.assetId).documents.push({ id: r.documentId!, title: r.title ?? String(r.kind) });
  for (const r of products) get(r.assetId!).products.push({ id: r.id, name: r.name });
  return out;
}

/**
 * Deletes the row and the file, and drops it from product galleries. Pages
 * that still point at it lose the image; callers warn with the usage first.
 */
export async function deleteAsset(orgId: string, id: string) {
  // product_image rows go with it (asset_id cascades).
  const [row] = await db.delete(asset).where(and(eq(asset.id, id), eq(asset.organizationId, orgId))).returning({ key: asset.key });
  if (row) await storage().delete(row.key).catch((e) => console.error("[media] file delete failed", row.key, e));
  return Boolean(row);
}

/** Library asset id for each gallery URL, only for files that belong to this organisation. */
export async function galleryAssetIds(orgId: string, urls: string[]) {
  const ids = [...new Set(urls.flatMap((u) => assetIdFromUrl(u) ?? []))];
  const known = ids.length ? await db.select({ id: asset.id }).from(asset).where(and(inArray(asset.id, ids), eq(asset.organizationId, orgId))) : [];
  const ok = new Set(known.map((a) => a.id));
  return urls.map((u) => {
    const id = assetIdFromUrl(u);
    return id && ok.has(id) ? id : null;
  });
}

export async function libraryStats(orgId: string) {
  const [row] = await db.select({ files: count(), bytes: sql<number>`coalesce(sum(${asset.size}), 0)::bigint` }).from(asset).where(eq(asset.organizationId, orgId));
  return { files: row?.files ?? 0, bytes: Number(row?.bytes ?? 0) };
}

// ------------------------------------------------------------------ tags ---

/** Tags are lower case, single-spaced, 1 to 40 characters. */
export const cleanTag = (tag: string) => tag.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ").slice(0, 40);

/** Every tag in the organisation with its file count, most used first. */
export async function orgTags(orgId: string) {
  return db
    .select({ tag: assetTag.tag, count: count() })
    .from(assetTag)
    .innerJoin(asset, eq(asset.id, assetTag.assetId))
    .where(eq(asset.organizationId, orgId))
    .groupBy(assetTag.tag)
    .orderBy(desc(count()), asc(assetTag.tag));
}

/** Adds and removes tags on files of this organisation; other ids are ignored. */
export async function tagAssets(orgId: string, ids: string[], change: { add?: string[]; remove?: string[] }) {
  const owned = ids.length ? (await db.select({ id: asset.id }).from(asset).where(and(inArray(asset.id, ids), eq(asset.organizationId, orgId)))).map((r) => r.id) : [];
  if (!owned.length) return [];
  const add = [...new Set((change.add ?? []).map(cleanTag).filter(Boolean))];
  const remove = [...new Set((change.remove ?? []).map(cleanTag).filter(Boolean))];
  await db.transaction(async (tx) => {
    if (remove.length) await tx.delete(assetTag).where(and(inArray(assetTag.assetId, owned), inArray(assetTag.tag, remove)));
    if (add.length) await tx.insert(assetTag).values(owned.flatMap((assetId) => add.map((tag) => ({ assetId, tag })))).onConflictDoNothing();
  });
  return withTags(await db.select().from(asset).where(inArray(asset.id, owned)));
}

// -------------------------------------------------------------- products ---

export type ProductCard = {
  id: string;
  name: string;
  /** Variant SKUs, or the legacy reference when there are none. */
  refs: string[];
  archived: boolean;
  imageCount: number;
  images: { url: string; alt: string; linked: boolean }[];
};

/**
 * Products lens: one card per product with its first images. `q` matches the
 * name anywhere and references by prefix, so `JBM-` finds JBM-001 and JBM-002.
 */
export async function listProductCards(input: { siteId: string; q?: string; missing?: boolean; offset?: number; limit?: number }) {
  const limit = Math.min(input.limit ?? 40, 100);
  const q = input.q?.trim() ? likeSafe(input.q.trim()) : undefined;
  const imageCount = sql<number>`(select count(*) from "product_image" pi where pi."product_id" = "product"."id")::int`;
  const rows = await db
    .select({ id: product.id, name: product.name, legacyId: product.legacyId, archived: product.isArchived, imageCount })
    .from(product)
    .where(
      and(
        eq(product.siteId, input.siteId),
        q
          ? or(
              ilike(product.name, `%${q}%`),
              ilike(product.legacyId, `${q}%`),
              sql`exists (select 1 from "product_variant" v where v."product_id" = "product"."id" and v."sku" ilike ${`${q}%`})`,
            )
          : undefined,
        input.missing ? sql`not exists (select 1 from "product_image" pi where pi."product_id" = "product"."id")` : undefined,
      ),
    )
    .orderBy(asc(product.isArchived), asc(product.name), asc(product.id))
    .limit(limit + 1)
    .offset(input.offset ?? 0);
  const page = rows.slice(0, limit);
  const ids = page.map((r) => r.id);
  const [images, skus] = ids.length
    ? await Promise.all([
        db
          .select({ productId: productImage.productId, url: productImage.url, alt: productImage.alt, assetId: productImage.assetId })
          .from(productImage)
          .where(and(inArray(productImage.productId, ids), lt(productImage.position, 4)))
          .orderBy(asc(productImage.position)),
        db
          .select({ productId: productVariant.productId, sku: productVariant.sku })
          .from(productVariant)
          .where(and(inArray(productVariant.productId, ids), sql`${productVariant.sku} is not null`))
          .orderBy(asc(productVariant.position)),
      ])
    : [[], []];
  const imagesBy = Map.groupBy(images, (i) => i.productId);
  const skusBy = Map.groupBy(skus, (s) => s.productId);
  const cards: ProductCard[] = page.map((r) => {
    const refs = skusBy.get(r.id)?.map((s) => s.sku!) ?? [];
    return {
      id: r.id,
      name: r.name,
      refs: refs.length ? refs : r.legacyId ? [r.legacyId] : [],
      archived: r.archived,
      imageCount: r.imageCount,
      images: (imagesBy.get(r.id) ?? []).map((i) => ({ url: i.url, alt: i.alt ?? "", linked: i.assetId !== null })),
    };
  });
  return { cards, more: rows.length > limit };
}
