import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@qubo/db/client";
import { organization, site, user } from "@qubo/db/schema";
import { eq } from "drizzle-orm";
import { daysLeft, purgeSite, purgeTrashedSites, restoreSite, trashSite, trashedSites, TRASH_RETENTION_DAYS } from "../src";

const tag = `tr${Date.now().toString(36)}`;
let orgId = "";
let userId = "";
let draftId = "";
let liveId = "";

beforeAll(async () => {
  userId = `trash-test-${tag}`;
  await db.insert(user).values({ id: userId, name: "Trash Test", email: `${tag}@studio.test` });
  const [org] = await db.insert(organization).values({ name: "Trash test", slug: `trash-${tag}` }).returning();
  orgId = org!.id;
  const [d, l] = await db
    .insert(site)
    .values([
      { organizationId: orgId, name: "Draft", slug: `draft-${tag}`, ownerId: userId },
      { organizationId: orgId, name: "Live", slug: `live-${tag}`, ownerId: userId, publishedAt: new Date() },
    ])
    .returning();
  draftId = d!.id;
  liveId = l!.id;
});

afterAll(async () => {
  if (orgId) await db.delete(organization).where(eq(organization.id, orgId));
  if (userId) await db.delete(user).where(eq(user.id, userId));
});

const row = async (id: string) => (await db.select({ deletedAt: site.deletedAt, deletedById: site.deletedById }).from(site).where(eq(site.id, id)))[0];

describe("site recycle bin", () => {
  it("refuses a live site", async () => {
    await expect(trashSite(liveId, userId)).rejects.toThrow(/live site/i);
    expect((await row(liveId))!.deletedAt).toBeNull();
  });

  it("trashes a draft, lists it, restores it", async () => {
    await trashSite(draftId, userId);
    const r = await row(draftId);
    expect(r!.deletedAt).toBeInstanceOf(Date);
    expect(r!.deletedById).toBe(userId);
    expect(daysLeft(r!.deletedAt!)).toBe(TRASH_RETENTION_DAYS);

    const bin = await trashedSites([orgId]);
    expect(bin.map((s) => s.id)).toEqual([draftId]);
    expect(await trashedSites([])).toEqual([]);

    await restoreSite(draftId);
    expect((await row(draftId))!.deletedAt).toBeNull();
    expect(await trashedSites([orgId])).toEqual([]);
  });

  it("purges only sites that are in the bin", async () => {
    await expect(purgeSite(draftId)).rejects.toThrow();
    await expect(purgeSite(liveId)).rejects.toThrow();

    await trashSite(draftId, userId);
    // Not old enough for the scheduled purge.
    expect(await purgeTrashedSites()).toBe(0);
    expect(await row(draftId)).toBeDefined();

    // Old enough.
    const old = new Date(Date.now() - (TRASH_RETENTION_DAYS + 1) * 86_400_000);
    await db.update(site).set({ deletedAt: old }).where(eq(site.id, draftId));
    expect(daysLeft(old)).toBe(0);
    expect(await purgeTrashedSites()).toBeGreaterThanOrEqual(1);
    expect(await row(draftId)).toBeUndefined();
  });

  it("purges on demand", async () => {
    const [s] = await db.insert(site).values({ organizationId: orgId, name: "Temp", slug: `temp-${tag}`, ownerId: userId }).returning();
    await trashSite(s!.id, userId);
    await purgeSite(s!.id);
    expect(await row(s!.id)).toBeUndefined();
  });
});
