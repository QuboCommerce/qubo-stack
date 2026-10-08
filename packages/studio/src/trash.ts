/**
 * The site recycle bin. Deleting a site is a soft delete: it drops out of every
 * host, list and quota at once but keeps its rows, slug and domains, so a restore
 * puts it back exactly. The purge deletes the row and lets the foreign keys cascade.
 */
import { db } from "@qubo/db/client";
import { site } from "@qubo/db/schema";
import { and, eq, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import { NotFoundError, ValidationError } from "./errors";

export const TRASH_RETENTION_DAYS = 60;

export function purgeDate(deletedAt: Date) {
  return new Date(deletedAt.getTime() + TRASH_RETENTION_DAYS * 86_400_000);
}

/** Whole days until the purge, never below zero. */
export function daysLeft(deletedAt: Date, now = new Date()) {
  return Math.max(0, Math.ceil((purgeDate(deletedAt).getTime() - now.getTime()) / 86_400_000));
}

/** Drafts only for now; a live site needs the typed-name guard that is not built yet. */
export async function trashSite(siteId: string, userId: string) {
  const [row] = await db.select({ publishedAt: site.publishedAt, deletedAt: site.deletedAt }).from(site).where(eq(site.id, siteId)).limit(1);
  if (!row) throw new NotFoundError("Site");
  if (row.deletedAt) return;
  if (row.publishedAt) throw new ValidationError([{ path: "site", message: "A live site can't be deleted yet. Put it in maintenance mode instead." }]);
  // The guard sits in the UPDATE so a publish racing the delete can't slip through.
  const updated = await db
    .update(site)
    .set({ deletedAt: new Date(), deletedById: userId, updatedAt: new Date() })
    .where(and(eq(site.id, siteId), isNull(site.publishedAt), isNull(site.deletedAt)))
    .returning({ id: site.id });
  if (!updated.length) throw new ValidationError([{ path: "site", message: "The site changed while deleting it. Reload and try again." }]);
}

export async function restoreSite(siteId: string) {
  const updated = await db
    .update(site)
    .set({ deletedAt: null, deletedById: null, updatedAt: new Date() })
    .where(and(eq(site.id, siteId), isNotNull(site.deletedAt)))
    .returning({ id: site.id });
  if (!updated.length) throw new NotFoundError("Site");
}

/** Permanent. Only sites already in the bin can be purged, so a bare id can never delete a live site. */
export async function purgeSite(siteId: string) {
  const gone = await db.delete(site).where(and(eq(site.id, siteId), isNotNull(site.deletedAt))).returning({ id: site.id });
  if (!gone.length) throw new NotFoundError("Site");
}

/** Called daily by the API. Returns how many sites were purged. */
export async function purgeTrashedSites(now = new Date()) {
  const cutoff = new Date(now.getTime() - TRASH_RETENTION_DAYS * 86_400_000);
  const gone = await db.delete(site).where(and(isNotNull(site.deletedAt), lt(site.deletedAt, cutoff))).returning({ id: site.id });
  return gone.length;
}

/** Sites in the bin for the given organisations, oldest deletion first. */
export async function trashedSites(organizationIds: string[]) {
  if (!organizationIds.length) return [];
  return db
    .select({
      id: site.id,
      slug: site.slug,
      name: site.name,
      type: site.type,
      locale: site.locale,
      organizationId: site.organizationId,
      deletedAt: site.deletedAt,
      deletedById: site.deletedById,
    })
    .from(site)
    .where(and(isNotNull(site.deletedAt), inArray(site.organizationId, organizationIds)))
    .orderBy(site.deletedAt);
}
