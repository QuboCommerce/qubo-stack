import { db } from "@qubo/db/client";
import { asset, assetUsage, document, page, product, productImage } from "@qubo/db/schema";
import { and, count, desc, eq, ilike, inArray, isNull, like, lt, or, sql, type SQL } from "drizzle-orm";
import { checkFile, cleanFilename, mediaKey, mediaUrl, problemMessage, type FileKind } from "./index";
import { dimensions, storage } from "./server";

/**
 * Media library. Assets belong to an organisation (the business); `siteId`
 * says which site uploaded it, null = shared by every site of the org.
 */

export type MediaScope = "here" | "site" | "shared" | "all";

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
  createdAt: string;
};

const kindOf = (mime: string): FileKind => (mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : "document");
const extOfKey = (key: string) => key.slice(key.lastIndexOf(".") + 1);

export const toMediaItem = (a: typeof asset.$inferSelect): MediaItem => ({
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
  createdAt: a.createdAt.toISOString(),
});

export type UploadResult = { ok: true; item: MediaItem } | { ok: false; error: string };

export async function uploadAsset(input: { orgId: string; siteId: string | null; userId: string; filename: string; bytes: Uint8Array; alt?: string }): Promise<UploadResult> {
  const filename = cleanFilename(input.filename);
  const checked = checkFile("media", filename, input.bytes);
  if (!checked.ok) return { ok: false, error: problemMessage(checked.problem, filename, "media") };
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

export async function listAssets(input: { orgId: string; siteId: string; scope: MediaScope; q?: string; kind?: FileKind; before?: string; limit?: number }) {
  const limit = Math.min(input.limit ?? 60, 200);
  const q = input.q?.trim();
  const kind = input.kind ? like(asset.mimeType, input.kind === "document" ? "application/%" : `${input.kind}/%`) : undefined;
  const rows = await db
    .select()
    .from(asset)
    .where(
      and(
        eq(asset.organizationId, input.orgId),
        scopeFilter(input.scope, input.siteId),
        q ? or(ilike(asset.filename, `%${q}%`), ilike(asset.alt, `%${q}%`)) : undefined,
        kind,
        input.before ? lt(asset.createdAt, new Date(input.before)) : undefined,
      ),
    )
    .orderBy(desc(asset.createdAt))
    .limit(limit + 1);
  return { items: rows.slice(0, limit).map(toMediaItem), more: rows.length > limit };
}

export async function getAsset(orgId: string, id: string) {
  const row = await db.query.asset.findFirst({ where: and(eq(asset.id, id), eq(asset.organizationId, orgId)) });
  return row ? toMediaItem(row) : null;
}

export async function updateAsset(orgId: string, id: string, patch: { alt?: string; filename?: string; siteId?: string | null }) {
  const set: Partial<typeof asset.$inferInsert> = {};
  if (patch.alt !== undefined) set.alt = patch.alt.trim().slice(0, 300);
  if (patch.filename !== undefined) set.filename = cleanFilename(patch.filename);
  if (patch.siteId !== undefined) set.siteId = patch.siteId;
  const [row] = await db.update(asset).set(set).where(and(eq(asset.id, id), eq(asset.organizationId, orgId))).returning();
  return row ? toMediaItem(row) : null;
}

/** Where an asset is used: page documents and products. */
export async function assetUsages(ids: string[]) {
  if (!ids.length) return new Map<string, { documents: { id: string; title: string | null }[]; products: { id: string; name: string }[] }>();
  const rows = await db
    .select({ assetId: assetUsage.assetId, documentId: assetUsage.documentId, ownerRef: assetUsage.ownerRef, title: page.title, kind: document.kind })
    .from(assetUsage)
    .leftJoin(document, eq(document.id, assetUsage.documentId))
    .leftJoin(page, eq(page.documentId, assetUsage.documentId))
    .where(inArray(assetUsage.assetId, ids));
  const productIds = [...new Set(rows.flatMap((r) => (r.ownerRef?.startsWith("product:") ? [r.ownerRef.slice(8)] : [])))];
  const products = productIds.length ? await db.select({ id: product.id, name: product.name }).from(product).where(inArray(product.id, productIds)) : [];
  const names = new Map(products.map((p) => [p.id, p.name]));
  const out = new Map<string, { documents: { id: string; title: string | null }[]; products: { id: string; name: string }[] }>();
  for (const r of rows) {
    const u = out.get(r.assetId) ?? { documents: [], products: [] };
    if (r.documentId) u.documents.push({ id: r.documentId, title: r.title ?? (r.kind ? String(r.kind) : null) });
    else if (r.ownerRef?.startsWith("product:") && names.has(r.ownerRef.slice(8))) u.products.push({ id: r.ownerRef.slice(8), name: names.get(r.ownerRef.slice(8))! });
    out.set(r.assetId, u);
  }
  return out;
}

/**
 * Deletes the row and the file, and drops it from product galleries. Pages
 * that still point at it lose the image; callers warn with the usage first.
 */
export async function deleteAsset(orgId: string, id: string) {
  const row = await db.transaction(async (tx) => {
    const [a] = await tx.delete(asset).where(and(eq(asset.id, id), eq(asset.organizationId, orgId))).returning({ key: asset.key });
    if (a) await tx.delete(productImage).where(eq(productImage.url, mediaUrl(orgId, id, extOfKey(a.key))));
    return a;
  });
  if (row) await storage().delete(row.key).catch((e) => console.error("[media] file delete failed", row.key, e));
  return Boolean(row);
}

/** Replaces `product:<id>` usage rows with the assets now on that product. */
export async function syncProductUsage(productId: string, urls: string[]) {
  const ids = urls.flatMap((u) => u.match(/\/api\/media\/[0-9a-f-]{36}\/([0-9a-f-]{36})\./i)?.[1] ?? []);
  const ownerRef = `product:${productId}`;
  await db.delete(assetUsage).where(eq(assetUsage.ownerRef, ownerRef));
  if (ids.length) {
    const known = await db.select({ id: asset.id }).from(asset).where(inArray(asset.id, ids));
    if (known.length) await db.insert(assetUsage).values(known.map((a) => ({ assetId: a.id, ownerRef })));
  }
}

export async function libraryStats(orgId: string) {
  const [row] = await db.select({ files: count(), bytes: sql<number>`coalesce(sum(${asset.size}), 0)::bigint` }).from(asset).where(eq(asset.organizationId, orgId));
  return { files: row?.files ?? 0, bytes: Number(row?.bytes ?? 0) };
}
