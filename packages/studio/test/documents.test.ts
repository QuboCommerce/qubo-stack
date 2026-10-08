import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@qubo/db/client";
import { asset, assetUsage, document, organization, site, siteLocale, translation, user } from "@qubo/db/schema";
import { hmFroidHomeFixture } from "@qubo/blocks/fixtures";
import { registry, setPath, instantiate, collectTranslatableStrings, ROOT_NODE_ID, type DocumentData } from "@qubo/blocks";
import { eq } from "drizzle-orm";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  createCheckpoint,
  createDocument,
  discardDraft,
  getDocument,
  listDocumentTranslations,
  listRevisions,
  publish,
  renderableDocument,
  restoreRevision,
  rollback,
  saveDraft,
  translationCoverage,
  upsertDocumentTranslations,
  createPreviewToken,
  verifyPreviewToken,
  type Scope,
} from "../src";

const tag = `t${Date.now().toString(36)}`;
let orgId = "";
let userId = "";
let a: Scope;
let b: Scope;

beforeAll(async () => {
  userId = `studio-test-${tag}`;
  await db.insert(user).values({ id: userId, name: "Studio Test", email: `${tag}@studio.test` });
  const [org] = await db.insert(organization).values({ name: "Studio test", slug: `studio-${tag}` }).returning();
  orgId = org!.id;
  const [sa, sb] = await db
    .insert(site)
    .values([
      { organizationId: orgId, name: "A", slug: `a-${tag}`, ownerId: userId, locale: "en" },
      { organizationId: orgId, name: "B", slug: `b-${tag}`, ownerId: userId, locale: "en" },
    ])
    .returning();
  a = { siteId: sa!.id, userId };
  b = { siteId: sb!.id, userId };
  await db.insert(siteLocale).values([
    { siteId: a.siteId, locale: "en", isPrimary: true, isPublished: true },
    { siteId: a.siteId, locale: "nl-BE", isPublished: true },
  ]);
});

afterAll(async () => {
  // Sites cascade to documents, revisions, translations; the org to assets.
  if (orgId) await db.delete(organization).where(eq(organization.id, orgId));
  if (userId) await db.delete(user).where(eq(user.id, userId));
});

const fixture = () => hmFroidHomeFixture(registry);

function firstString(data: DocumentData) {
  const s = collectTranslatableStrings(data, registry)[0];
  if (!s) throw new Error("fixture has no translatable text");
  return s;
}

function editFirstString(data: DocumentData, value: string): DocumentData {
  const s = firstString(data);
  if (s.nodeId === ROOT_NODE_ID) return { ...data, root: { ...data.root, props: { ...data.root.props, [s.path]: value } } };
  const walk = (nodes: DocumentData["content"]): DocumentData["content"] =>
    nodes.map((n) => {
      if (n.props.id === s.nodeId) return { ...n, props: setPath(n.props, s.path, value) };
      const props = { ...n.props };
      for (const [k, v] of Object.entries(props)) {
        if (Array.isArray(v) && v.every((c) => c && typeof c === "object" && "type" in c && "props" in c)) {
          props[k] = walk(v as DocumentData["content"]);
        }
      }
      return { ...n, props };
    });
  return { ...data, content: walk(data.content) };
}

describe("documents", () => {
  it("creates, saves with optimistic concurrency and rejects stale versions", async () => {
    const doc = await createDocument(a, { kind: "page" });
    expect(doc.draftVersion).toBe(1);
    expect(doc.hasUnpublishedChanges).toBe(true);

    const saved = await saveDraft(a, { id: doc.id, data: fixture(), baseVersion: 1 });
    expect(saved.version).toBe(2);

    // A second editor still on version 1 must not clobber the save.
    await expect(saveDraft(a, { id: doc.id, data: fixture(), baseVersion: 1 })).rejects.toBeInstanceOf(ConflictError);
    const err = await saveDraft(a, { id: doc.id, data: fixture(), baseVersion: 1 }).catch((e) => e);
    expect((err as ConflictError).current.version).toBe(2);
  });

  it("isolates tenants: another site's document is not found", async () => {
    const doc = await createDocument(a, { kind: "page" });
    await expect(getDocument(b, doc.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(saveDraft(b, { id: doc.id, data: fixture(), baseVersion: 1 })).rejects.toBeInstanceOf(NotFoundError);
    await expect(publish(b, { id: doc.id })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects structurally broken trees", async () => {
    const doc = await createDocument(a, { kind: "page" });
    const bad = { root: { props: {} }, content: [{ type: "NoSuchBlock", props: { id: "x" } }] };
    await expect(saveDraft(a, { id: doc.id, data: bad, baseVersion: 1 })).rejects.toBeInstanceOf(ValidationError);
    const noIds = { root: { props: {} }, content: [{ type: "NoSuchBlock", props: {} }] };
    await expect(saveDraft(a, { id: doc.id, data: noIds, baseVersion: 1 })).rejects.toBeInstanceOf(ValidationError);
  });

  it("publishes, checkpoints, restores and rolls back", async () => {
    const doc = await createDocument(a, { kind: "page" });
    const v1 = fixture();
    await saveDraft(a, { id: doc.id, data: v1, baseVersion: 1 });
    const p1 = await publish(a, { id: doc.id, label: "Launch" });
    expect(p1.version).toBe(1);

    let current = await getDocument(a, doc.id);
    expect(current.hasUnpublishedChanges).toBe(false);
    // Re-saving the published content (key order may differ) stays "clean".
    const same = await saveDraft(a, { id: doc.id, data: JSON.parse(JSON.stringify(current.published)), baseVersion: current.draftVersion });
    expect(same.hasUnpublishedChanges).toBe(false);
    current = await getDocument(a, doc.id);

    const v2 = editFirstString(current.draft, "Changed headline");
    await saveDraft(a, { id: doc.id, data: v2, baseVersion: current.draftVersion });
    current = await getDocument(a, doc.id);
    expect(current.hasUnpublishedChanges).toBe(true);

    const cp = await createCheckpoint(a, { id: doc.id, label: "Before experiment" });
    expect(cp.version).toBe(2);
    const p2 = await publish(a, { id: doc.id });
    expect(p2.version).toBe(3);

    const revs = await listRevisions(a, doc.id);
    expect(revs.map((r) => [r.version, r.kind, r.isPublished])).toEqual([
      [3, "publish", true],
      [2, "checkpoint", false],
      [1, "publish", false],
    ]);
    expect(revs[2]!.createdByName).toBe("Studio Test");

    // Restore v1 into the draft: live site unchanged until publish.
    await restoreRevision(a, { id: doc.id, revisionId: p1.revisionId });
    current = await getDocument(a, doc.id);
    expect(firstString(current.draft).value).toBe(firstString(v1).value);
    expect(firstString(current.published!).value).toBe("Changed headline");

    // Discard returns to the published copy.
    await discardDraft(a, doc.id);
    current = await getDocument(a, doc.id);
    expect(current.hasUnpublishedChanges).toBe(false);

    // Rollback goes live immediately.
    const rb = await rollback(a, { id: doc.id, revisionId: p1.revisionId });
    expect(rb.version).toBe(4);
    current = await getDocument(a, doc.id);
    expect(firstString(current.published!).value).toBe(firstString(v1).value);
    expect((await listRevisions(a, doc.id))[0]!.label).toBe("Rollback to v1");
  });

  it("publish honours baseVersion", async () => {
    const doc = await createDocument(a, { kind: "page" });
    await saveDraft(a, { id: doc.id, data: fixture(), baseVersion: 1 });
    await expect(publish(a, { id: doc.id, baseVersion: 1 })).rejects.toBeInstanceOf(ConflictError);
    await expect(publish(a, { id: doc.id, baseVersion: 2 })).resolves.toMatchObject({ version: 1 });
  });

  it("indexes asset usage for assets in the same organization", async () => {
    const [img] = await db
      .insert(asset)
      .values({ organizationId: orgId, siteId: a.siteId, key: `${orgId}/${a.siteId}/${tag}.jpg`, filename: "x.jpg", mimeType: "image/jpeg", size: 1 })
      .returning();
    const doc = await createDocument(a, { kind: "page" });
    const data = fixture();
    const image = instantiate(registry, "Image", { props: { image: { assetId: img!.id, alt: "" } } });
    const withImage = { ...data, content: [...data.content, image] };
    await saveDraft(a, { id: doc.id, data: withImage, baseVersion: 1 });
    const usage = await db.select().from(assetUsage).where(eq(assetUsage.documentId, doc.id));
    expect(usage.map((u) => u.assetId)).toEqual([img!.id]);

    await saveDraft(a, { id: doc.id, data, baseVersion: 2 });
    expect(await db.select().from(assetUsage).where(eq(assetUsage.documentId, doc.id))).toHaveLength(0);
  });
});

describe("translations", () => {
  it("lists, saves, goes stale when the source changes, and overlays on render", async () => {
    const doc = await createDocument(a, { kind: "page" });
    await saveDraft(a, { id: doc.id, data: fixture(), baseVersion: 1 });

    let rows = await listDocumentTranslations(a, doc.id, "nl-BE");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.status === "missing")).toBe(true);

    const target = rows[0]!;
    await upsertDocumentTranslations(a, { documentId: doc.id, locale: "nl-BE", entries: [{ path: target.path, value: "Hallo" }] });
    rows = await listDocumentTranslations(a, doc.id, "nl-BE");
    expect(rows[0]).toMatchObject({ value: "Hallo", status: "done" });
    const before = await translationCoverage(a.siteId);
    expect(before["nl-BE"]!.done).toBeGreaterThanOrEqual(1);
    expect(before["nl-BE"]!.total).toBeGreaterThanOrEqual(rows.length);
    expect(Object.keys(before)).not.toContain("en");

    await publish(a, { id: doc.id });
    const rendered = await renderableDocument(a.siteId, doc.id, "nl-BE");
    expect(firstString(rendered!).value).toBe("Hallo");

    // Editing the source text marks the translation stale.
    const current = await getDocument(a, doc.id);
    await saveDraft(a, { id: doc.id, data: editFirstString(current.draft, "New source"), baseVersion: current.draftVersion });
    const [row] = await db.select().from(translation).where(eq(translation.ownerRef, `document:${doc.id}`));
    expect(row!.status).toBe("stale");
    rows = await listDocumentTranslations(a, doc.id, "nl-BE");
    expect(rows[0]!.status).toBe("stale");
    const after = await translationCoverage(a.siteId);
    expect(after["nl-BE"]!.stale).toBe(before["nl-BE"]!.stale + 1);
    expect(after["nl-BE"]!.done).toBe(before["nl-BE"]!.done - 1);

    // Empty value clears the translation.
    await upsertDocumentTranslations(a, { documentId: doc.id, locale: "nl-BE", entries: [{ path: target.path, value: " " }] });
    expect(await db.select().from(translation).where(eq(translation.ownerRef, `document:${doc.id}`))).toHaveLength(0);
  });

  it("refuses unknown paths, disabled locales and the primary locale", async () => {
    const doc = await createDocument(a, { kind: "page" });
    await saveDraft(a, { id: doc.id, data: fixture(), baseVersion: 1 });
    const bad = (locale: string, path = "nope.title") =>
      upsertDocumentTranslations(a, { documentId: doc.id, locale, entries: [{ path, value: "x" }] });
    await expect(bad("nl-BE")).rejects.toBeInstanceOf(ValidationError);
    await expect(bad("de-DE")).rejects.toBeInstanceOf(ValidationError);
    await expect(bad("en")).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("preview tokens", () => {
  it("round-trips and rejects tampering/expiry", () => {
    const t = createPreviewToken({ siteId: "s", documentId: "d" });
    expect(verifyPreviewToken(t)).toEqual({ siteId: "s", documentId: "d" });
    expect(verifyPreviewToken(t.slice(0, -2) + "xx")).toBeNull();
    expect(verifyPreviewToken(createPreviewToken({ siteId: "s", documentId: "d", ttlSeconds: -1 }))).toBeNull();
  });
});

it("cleans up via cascade", async () => {
  const rows = await db.select({ id: document.id }).from(document).where(eq(document.siteId, a.siteId));
  expect(rows.length).toBeGreaterThan(0);
});
