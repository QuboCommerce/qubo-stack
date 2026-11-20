"use server";

import { db } from "@qubo/db/client";
import { asset } from "@qubo/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import {
  assetUsages,
  deleteAsset,
  listAssets,
  listProductCards,
  MEDIA_LENSES,
  orgTags,
  tagAssets,
  updateAsset,
  type MediaItem,
  type MediaLens,
  type MediaScope,
  type ProductCard,
} from "@qubo/storage/media";
import { z } from "zod";
import { requireSite } from "@/lib/admin";
import { assetUrl } from "@/lib/format";

const Scope = z.enum(["here", "site", "shared", "all"]);
const Kind = z.enum(["image", "video", "document"]);
const Lens = z.enum(MEDIA_LENSES);
const Ids = z.array(z.uuid()).min(1).max(200);

export type MediaPage = { items: MediaItem[]; more: boolean };

export async function listMediaAction(input: {
  site: string;
  scope: MediaScope;
  lens?: MediaLens;
  tag?: string;
  q?: string;
  kind?: "image" | "video" | "document";
  before?: string;
}): Promise<MediaPage> {
  const { site } = await requireSite(input.site);
  const p = z
    .object({ scope: Scope, lens: Lens.optional(), tag: z.string().max(40).optional(), q: z.string().max(100).optional(), kind: Kind.optional(), before: z.iso.datetime().optional() })
    .parse(input);
  return listAssets({ orgId: site.organizationId, siteId: site.id, ...p });
}

export type MediaFacets = { lenses: MediaLens[]; tags: { tag: string; count: number }[] };

/** Lenses this site can show (a module lens only when its capability is on) and the organisation's tags. */
export async function mediaFacetsAction(input: { site: string }): Promise<MediaFacets> {
  const { site } = await requireSite(input.site);
  const caps = new Set<string>(site.capabilities);
  const lenses = MEDIA_LENSES.filter((l) => {
    if (l === "products") return caps.has("catalog") || caps.has("commerce");
    if (l === "blog") return caps.has("blog");
    return true;
  });
  return { lenses, tags: await orgTags(site.organizationId) };
}

export type ProductCardPage = { cards: (Omit<ProductCard, "images"> & { images: (ProductCard["images"][number] & { src: string })[] })[]; more: boolean };

export async function listProductCardsAction(input: { site: string; q?: string; missing?: boolean; offset?: number }): Promise<ProductCardPage> {
  const { siteId } = await requireSite(input.site);
  const p = z.object({ q: z.string().max(100).optional(), missing: z.boolean().optional(), offset: z.number().int().min(0).max(100_000).optional() }).parse(input);
  const page = await listProductCards({ siteId, ...p });
  return { ...page, cards: page.cards.map((c) => ({ ...c, images: c.images.map((i) => ({ ...i, src: assetUrl(i.url) ?? i.url })) })) };
}

export type MediaUsage = { documents: { id: string; title: string | null }[]; products: { id: string; name: string }[] };

export async function mediaUsageAction(input: { site: string; id: string }): Promise<MediaUsage> {
  const { site } = await requireSite(input.site);
  const id = z.uuid().parse(input.id);
  const [row] = await db.select({ id: asset.id }).from(asset).where(and(eq(asset.id, id), eq(asset.organizationId, site.organizationId)));
  if (!row) return { documents: [], products: [] };
  return (await assetUsages([id])).get(id) ?? { documents: [], products: [] };
}

export async function updateMediaAction(input: { site: string; id: string; alt?: string; filename?: string; shared?: boolean }): Promise<MediaItem | { error: string }> {
  const { site } = await requireSite(input.site);
  const p = z.object({ id: z.uuid(), alt: z.string().max(300).optional(), filename: z.string().min(1).max(200).optional(), shared: z.boolean().optional() }).parse(input);
  const item = await updateAsset(site.organizationId, p.id, {
    alt: p.alt,
    filename: p.filename,
    // Only "share with every site" or "keep to this site": never hand a file to a site you aren't on.
    siteId: p.shared === undefined ? undefined : p.shared ? null : site.id,
  });
  return item ?? { error: "File not found." };
}

export async function tagMediaAction(input: { site: string; ids: string[]; add?: string[]; remove?: string[] }): Promise<MediaItem[]> {
  const { site } = await requireSite(input.site);
  const tag = z.string().min(1).max(40);
  const p = z.object({ ids: Ids, add: z.array(tag).max(20).optional(), remove: z.array(tag).max(20).optional() }).parse(input);
  return tagAssets(site.organizationId, p.ids, p);
}

/** Bulk "share with every site" / "keep to this site". Files uploaded on another site are left alone. */
export async function shareMediaAction(input: { site: string; ids: string[]; shared: boolean }): Promise<MediaItem[]> {
  const { site } = await requireSite(input.site);
  const p = z.object({ ids: Ids, shared: z.boolean() }).parse(input);
  const rows = await db.select({ id: asset.id, siteId: asset.siteId }).from(asset).where(and(inArray(asset.id, p.ids), eq(asset.organizationId, site.organizationId)));
  const out: MediaItem[] = [];
  for (const r of rows) {
    if (r.siteId !== null && r.siteId !== site.id) continue;
    const item = await updateAsset(site.organizationId, r.id, { siteId: p.shared ? null : site.id });
    if (item) out.push(item);
  }
  return out;
}

export async function deleteMediaAction(input: { site: string; id: string }): Promise<{ ok: true } | { error: string }> {
  const res = await deleteManyMediaAction({ site: input.site, ids: [input.id] });
  return res.deleted.length ? { ok: true } : { error: res.error ?? "File not found." };
}

/** Deletes what the user may delete: an admin anything, others only their own uploads. */
export async function deleteManyMediaAction(input: { site: string; ids: string[] }): Promise<{ deleted: string[]; error?: string }> {
  const { site, user } = await requireSite(input.site);
  const ids = Ids.parse(input.ids);
  const rows = await db.select({ id: asset.id, by: asset.createdById }).from(asset).where(and(inArray(asset.id, ids), eq(asset.organizationId, site.organizationId)));
  const manager = site.memberRole === "OWNER" || site.memberRole === "ADMIN";
  const allowed = rows.filter((r) => manager || r.by === user.id);
  for (const r of allowed) await deleteAsset(site.organizationId, r.id);
  const skipped = rows.length - allowed.length;
  return {
    deleted: allowed.map((r) => r.id),
    error: skipped ? `${skipped} file${skipped === 1 ? " was" : "s were"} kept: only the uploader or an organisation admin can delete ${skipped === 1 ? "it" : "them"}.` : rows.length ? undefined : "File not found.",
  };
}
