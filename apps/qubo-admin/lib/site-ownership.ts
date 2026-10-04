import "server-only";

import { db } from "@qubo/db/client";
import { asset, font, organization, organizationMember, site } from "@qubo/db/schema";
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
