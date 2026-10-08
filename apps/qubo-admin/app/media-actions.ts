"use server";

import { db } from "@qubo/db/client";
import { asset } from "@qubo/db/schema";
import { and, eq } from "drizzle-orm";
import { assetUsages, deleteAsset, listAssets, updateAsset, type MediaItem, type MediaScope } from "@qubo/storage/media";
import { z } from "zod";
import { requireSite } from "@/lib/admin";

const Scope = z.enum(["here", "site", "shared", "all"]);
const Kind = z.enum(["image", "video", "document"]);

export type MediaPage = { items: MediaItem[]; more: boolean };

export async function listMediaAction(input: { site: string; scope: MediaScope; q?: string; kind?: "image" | "video" | "document"; before?: string }): Promise<MediaPage> {
  const { site } = await requireSite(input.site);
  const p = z.object({ scope: Scope, q: z.string().max(100).optional(), kind: Kind.optional(), before: z.iso.datetime().optional() }).parse(input);
  return listAssets({ orgId: site.organizationId, siteId: site.id, ...p });
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

export async function deleteMediaAction(input: { site: string; id: string }): Promise<{ ok: true } | { error: string }> {
  const { site, user } = await requireSite(input.site);
  const id = z.uuid().parse(input.id);
  const [row] = await db.select({ by: asset.createdById }).from(asset).where(and(eq(asset.id, id), eq(asset.organizationId, site.organizationId)));
  if (!row) return { error: "File not found." };
  const manager = site.memberRole === "OWNER" || site.memberRole === "ADMIN";
  if (!manager && row.by !== user.id) return { error: "Only the uploader or an organisation admin can delete this file." };
  await deleteAsset(site.organizationId, id);
  return { ok: true };
}
