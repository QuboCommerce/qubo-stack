import "server-only";

import { db } from "@qubo/db/client";
import { asset, font, organization, organizationMember, site, user } from "@qubo/db/schema";
import * as studio from "@qubo/studio";
import { StudioError, ValidationError } from "@qubo/studio";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getAccess, requireUser } from "@/lib/admin";

/**
 * Who owns a site. Rules (portal POLICIES): drafts move between organisations
 * for free; the first publish fixes the organisation for good, because orders,
 * invoices and customers hang off the legal entity that sold. Exceptions are an
 * assisted migration, done by hand.
 */

const MANAGERS = ["OWNER", "ADMIN"] as const;

/** Organisations the user may publish to or move drafts into: manager role, not locked by the plan. */
export async function manageableOrgs() {
  const [user, licence] = await Promise.all([requireUser(), getAccess()]);
  const rows = await db
    .select({ id: organization.id, name: organization.name, legalName: organization.legalName, companyNumber: organization.companyNumber })
    .from(organizationMember)
    .innerJoin(organization, eq(organization.id, organizationMember.organizationId))
    .where(and(eq(organizationMember.userId, user.id), inArray(organizationMember.role, [...MANAGERS])))
    .orderBy(asc(organization.createdAt));
  return rows.filter((o) => !licence.lockedOrgIds.has(o.id));
}
export type ManageableOrg = Awaited<ReturnType<typeof manageableOrgs>>[number];

export class OwnershipError extends Error {}

async function assertTarget(siteId: string, targetOrgId: string) {
  const orgs = await manageableOrgs();
  const [row] = await db.select({ organizationId: site.organizationId, publishedAt: site.publishedAt }).from(site).where(eq(site.id, siteId)).limit(1);
  if (!row) throw new OwnershipError("Site not found.");
  if (!orgs.some((o) => o.id === row.organizationId)) throw new OwnershipError("Only owners and admins of the site's organisation can do this.");
  if (!orgs.some((o) => o.id === targetOrgId)) throw new OwnershipError("You can't add sites to that organisation.");
  return row;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Moves the site and its own media; copies the org fonts it may use (fonts are per organisation). */
async function transfer(tx: Tx, siteId: string, from: string, to: string) {
  await tx.update(site).set({ organizationId: to, updatedAt: new Date() }).where(eq(site.id, siteId));
  await tx.update(asset).set({ organizationId: to }).where(eq(asset.siteId, siteId));
  await tx.execute(sql`
    insert into ${font} (organization_id, family, source, files, fallback)
    select ${to}, family, source, files, fallback from ${font} where organization_id = ${from}
    on conflict (organization_id, family) do nothing`);
}

/** Draft only. The `published_at is null` guard sits in the UPDATE, so a publish racing a move can't slip through. */
export async function moveDraft(siteId: string, targetOrgId: string) {
  const row = await assertTarget(siteId, targetOrgId);
  if (row.publishedAt) throw new OwnershipError("Published sites stay in their organisation. Contact support for an assisted migration.");
  if (row.organizationId === targetOrgId) return;
  await db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ id: site.id })
      .from(site)
      .where(and(eq(site.id, siteId), isNull(site.publishedAt), eq(site.organizationId, row.organizationId)))
      .for("update");
    if (!locked) throw new OwnershipError("This site was published or moved meanwhile. Reload and try again.");
    await transfer(tx, siteId, row.organizationId, targetOrgId);
  });
}

/** First publish, into the confirmed organisation. One-way. */
export async function publish(siteId: string, targetOrgId: string) {
  const row = await assertTarget(siteId, targetOrgId);
  if (row.publishedAt) throw new OwnershipError("This site is already published.");
  await db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ id: site.id })
      .from(site)
      .where(and(eq(site.id, siteId), isNull(site.publishedAt), eq(site.organizationId, row.organizationId)))
      .for("update");
    if (!locked) throw new OwnershipError("This site was published or moved meanwhile. Reload and try again.");
    if (row.organizationId !== targetOrgId) await transfer(tx, siteId, row.organizationId, targetOrgId);
    await tx.update(site).set({ publishedAt: new Date(), updatedAt: new Date() }).where(eq(site.id, siteId));
  });
}

// ------------------------------------------------------------ recycle bin ---

/** Manager of the site's organisation, deleted or not. Returns the organisation. */
async function assertManagerOf(siteId: string) {
  const orgs = await manageableOrgs();
  const [row] = await db.select({ organizationId: site.organizationId }).from(site).where(eq(site.id, siteId)).limit(1);
  if (!row) throw new OwnershipError("Site not found.");
  if (!orgs.some((o) => o.id === row.organizationId)) throw new OwnershipError("Only owners and admins of the site's organisation can do this.");
  return row.organizationId;
}

const lifecycleError = (e: unknown) => {
  if (e instanceof StudioError) return new OwnershipError(e instanceof ValidationError ? (e.issues[0]?.message ?? e.message) : e.message);
  return e;
};

/** Draft to the bin. */
export async function trashSite(siteId: string) {
  const user = await requireUser();
  await assertManagerOf(siteId);
  await studio.trashSite(siteId, user.id).catch((e) => Promise.reject(lifecycleError(e)));
}

export async function restoreSite(siteId: string) {
  await assertManagerOf(siteId);
  await studio.restoreSite(siteId).catch((e) => Promise.reject(lifecycleError(e)));
}

/** Permanent, without waiting the retention period. */
export async function purgeSite(siteId: string) {
  await assertManagerOf(siteId);
  await studio.purgeSite(siteId).catch((e) => Promise.reject(lifecycleError(e)));
}

/** The bin for one organisation, with who deleted each site and when it is purged. */
export async function recycleBin(organizationId: string) {
  const rows = await studio.trashedSites([organizationId]);
  const byIds = rows.map((r) => r.deletedById).filter((id): id is string => !!id);
  const users = byIds.length ? await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, byIds)) : [];
  return rows.map((r) => ({
    ...r,
    deletedAt: r.deletedAt!,
    deletedBy: users.find((u) => u.id === r.deletedById)?.name ?? null,
    purgeAt: studio.purgeDate(r.deletedAt!),
    daysLeft: studio.daysLeft(r.deletedAt!),
  }));
}
export type TrashedSite = Awaited<ReturnType<typeof recycleBin>>[number];
