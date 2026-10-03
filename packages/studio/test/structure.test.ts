import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@qubo/db/client";
import { document, organization, page, site, template, theme, user } from "@qubo/db/schema";
import { hmFroidHomeFixture } from "@qubo/blocks/fixtures";
import { registry } from "@qubo/blocks";
import { hmFroidTheme } from "@qubo/stylekit";
import { eq } from "drizzle-orm";
import {
  NotFoundError,
  StudioError,
  ValidationError,
  activateTheme,
  createDocument,
  createPage,
  createTemplate,
  deletePage,
  deleteTemplate,
  getDocument,
  liveThemeCss,
  publish,
  publishTheme,
  updatePage,
  viewIndex,
  type Scope,
} from "../src";

const tag = `t${Date.now().toString(36)}`;
let orgId = "";
let userId = "";
let s: Scope;

beforeAll(async () => {
  userId = `studio-struct-${tag}`;
  await db.insert(user).values({ id: userId, name: "Struct Test", email: `${tag}@struct.test` });
  const [org] = await db.insert(organization).values({ name: "Struct", slug: `struct-${tag}` }).returning();
  orgId = org!.id;
  const [row] = await db
    .insert(site)
    .values({ organizationId: orgId, name: "S", slug: `s-${tag}`, ownerId: userId, locale: "en", capabilities: ["catalog"] })
    .returning();
  s = { siteId: row!.id, userId };
  // Minimal seed: a default page template and a system 404.
  const pageDoc = await createDocument(s, { kind: "template", data: hmFroidHomeFixture(registry) });
  const nf = await createDocument(s, { kind: "template" });
  const prodDoc = await createDocument(s, { kind: "template" });
  await db.insert(template).values([
    { siteId: s.siteId, resourceKind: "page", handle: "default", name: "Default page", documentId: pageDoc.id },
    { siteId: s.siteId, resourceKind: "not_found", handle: "default", name: "404", isSystem: true, documentId: nf.id },
    { siteId: s.siteId, resourceKind: "product", handle: "default", name: "Product", documentId: prodDoc.id },
  ]);
});

afterAll(async () => {
  if (orgId) await db.delete(organization).where(eq(organization.id, orgId));
  if (userId) await db.delete(user).where(eq(user.id, userId));
});

describe("pages", () => {
  it("creates from the page template, slugifies, publishes and deletes", async () => {
    const p = await createPage(s, { title: "Nos Réalisations" });
    expect(p.slug).toBe("nos-realisations");
    expect(p.locale).toBe("en");
    expect(p.state).toBe("DRAFT");
    const doc = await getDocument(s, p.documentId!);
    expect(doc.draft.content.length).toBeGreaterThan(0);

    await expect(createPage(s, { title: "Other", slug: "nos-realisations" })).rejects.toBeInstanceOf(ValidationError);

    await publish(s, { id: p.documentId! });
    const [after] = await db.select().from(page).where(eq(page.id, p.id));
    expect(after!.state).toBe("PUBLISHED");

    const up = await updatePage(s, p.id, { slug: "projects", metaDescription: "  Our work " });
    expect(up.slug).toBe("projects");
    expect(up.metaDescription).toBe("Our work");

    const index = await viewIndex(s);
    expect(index.groups.find((g) => g.id === "pages")!.entries.some((e) => e.key === `page:${p.id}`)).toBe(true);

    await deletePage(s, p.id);
    expect(await db.select().from(document).where(eq(document.id, p.documentId!))).toHaveLength(0);
    await expect(deletePage(s, p.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("templates", () => {
  it("creates alternates as copies and protects defaults/system", async () => {
    const alt = await createTemplate(s, { resourceKind: "product", handle: "cold room!", name: "Cold room" }).catch((e) => e);
    expect(alt).toBeInstanceOf(ValidationError); // spaces/punctuation

    const ok = await createTemplate(s, { resourceKind: "page", handle: "landing", name: "Landing" });
    const doc = await getDocument(s, ok.documentId);
    expect(doc.draft.content.length).toBeGreaterThan(0);
    await expect(createTemplate(s, { resourceKind: "page", handle: "landing", name: "Again" })).rejects.toBeInstanceOf(ValidationError);
    await expect(createTemplate(s, { resourceKind: "not_found", handle: "alt", name: "x" })).rejects.toBeInstanceOf(StudioError);

    const p = await createPage(s, { title: "Promo", templateHandle: "landing" });
    await expect(deleteTemplate(s, ok.id)).rejects.toMatchObject({ code: "conflict" });
    await deletePage(s, p.id);
    await deleteTemplate(s, ok.id);

    const [def] = await db.select().from(template).where(eq(template.siteId, s.siteId));
    await expect(deleteTemplate(s, def!.id)).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("theme css", () => {
  it("compiles the live theme with a stable hash", async () => {
    expect(await liveThemeCss(s.siteId)).toBeNull();
    const [t] = await db.insert(theme).values({ siteId: s.siteId, name: "HM", draft: hmFroidTheme }).returning();
    await publishTheme(s, { id: t!.id });
    await activateTheme(s, t!.id);
    const a = await liveThemeCss(s.siteId);
    const b = await liveThemeCss(s.siteId);
    expect(a!.css).toContain(`[data-theme="${hmFroidTheme.id}"]`);
    expect(a!.hash).toBe(b!.hash);
  });
});
