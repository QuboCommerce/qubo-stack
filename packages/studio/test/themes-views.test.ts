import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@peltier/db/client";
import { organization, site, theme, user } from "@peltier/db/schema";
import { hmFroidTheme, lumeTheme } from "@peltier/stylekit";
import { eq } from "drizzle-orm";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  activateTheme,
  duplicateTheme,
  getLiveTheme,
  getTheme,
  listThemeRevisions,
  publishTheme,
  restoreThemeRevision,
  saveThemeDraft,
  viewIndex,
  resolveView,
  type Scope,
} from "../src";

const tag = `t${Date.now().toString(36)}`;
let orgId = "";
let userId = "";
let s: Scope;
let themeId = "";

beforeAll(async () => {
  userId = `studio-theme-${tag}`;
  await db.insert(user).values({ id: userId, name: "Theme Test", email: `${tag}@theme.test` });
  const [org] = await db.insert(organization).values({ name: "Theme test", slug: `theme-${tag}` }).returning();
  orgId = org!.id;
  const [row] = await db.insert(site).values({ organizationId: orgId, name: "T", slug: `t-${tag}`, ownerId: userId }).returning();
  s = { siteId: row!.id, userId };
  const [t] = await db.insert(theme).values({ siteId: s.siteId, name: "HM", draft: hmFroidTheme }).returning();
  themeId = t!.id;
});

afterAll(async () => {
  if (orgId) await db.delete(organization).where(eq(organization.id, orgId));
  if (userId) await db.delete(user).where(eq(user.id, userId));
});

describe("themes", () => {
  it("saves with doctor scores, publishes, activates and restores", async () => {
    const saved = await saveThemeDraft(s, { id: themeId, data: lumeTheme, baseVersion: 1 });
    expect(saved.version).toBe(2);
    expect(saved.report.health).toBeGreaterThan(0);
    await expect(saveThemeDraft(s, { id: themeId, data: lumeTheme, baseVersion: 1 })).rejects.toBeInstanceOf(ConflictError);
    await expect(saveThemeDraft(s, { id: themeId, data: { nope: true }, baseVersion: 2 })).rejects.toBeInstanceOf(ValidationError);

    await expect(activateTheme(s, themeId)).rejects.toBeInstanceOf(ValidationError);
    const p1 = await publishTheme(s, { id: themeId, label: "Lumé look" });
    await activateTheme(s, themeId);
    expect((await getLiveTheme(s.siteId))?.id).toBe(lumeTheme.id);

    const copy = await duplicateTheme(s, themeId);
    expect(copy.isActive).toBe(false);
    expect(copy.name).toBe("Copy of HM");

    await saveThemeDraft(s, { id: themeId, data: hmFroidTheme, baseVersion: 2 });
    await publishTheme(s, { id: themeId });
    expect((await listThemeRevisions(s, themeId)).map((r) => r.version)).toEqual([2, 1]);

    await restoreThemeRevision(s, { id: themeId, revisionId: p1.revisionId });
    const t = await getTheme(s, themeId);
    expect(t.draft.id).toBe(lumeTheme.id);
    expect(t.hasUnpublishedChanges).toBe(true);
  });

  it("is site-scoped", async () => {
    await expect(getTheme({ siteId: "00000000-0000-0000-0000-000000000000" }, themeId)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("view index (seeded hm-froid)", () => {
  it("groups templates by capability with system pages last", async () => {
    const [hm] = await db.select({ id: site.id }).from(site).where(eq(site.slug, "hm-froid"));
    if (!hm) return; // seed not present
    const index = await viewIndex({ siteId: hm.id });
    const ids = index.groups.map((g) => g.id);
    expect(ids[0]).toBe("core");
    expect(ids.at(-1)).toBe("system");
    expect(ids).toContain("catalog");
    expect(index.groups[0]!.entries[0]!.resourceKind).toBe("home");
    expect(index.groups.at(-1)!.entries.every((e) => e.isSystem)).toBe(true);
    expect(index.sectionGroups.map((g) => g.key)).toEqual(["group:header", "group:footer"]);
    const home = await resolveView({ siteId: hm.id }, index.groups[0]!.entries[0]!.key);
    expect(home.documentId).toBeTruthy();
    await expect(resolveView({ siteId: hm.id }, "template:nope")).rejects.toBeInstanceOf(NotFoundError);
  });
});
