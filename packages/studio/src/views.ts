import { page, sectionGroup, site, template } from "@peltier/db/schema";
import { and, asc, eq } from "drizzle-orm";
import type { Capability } from "@peltier/blocks";
import { document } from "@peltier/db/schema";
import { db, type Scope } from "./db";
import { NotFoundError } from "./errors";

export type ResourceKind = (typeof template.$inferSelect)["resourceKind"];

/**
 * The Studio view picker (Shopify's "Home page ▾" dropdown). Groups follow
 * usage frequency: the storefront's core views first, system pages last.
 * A group whose capability is off is hidden, but its templates are kept.
 */
export const viewGroups: { id: string; label: string; kinds: ResourceKind[]; requires?: Capability[] }[] = [
  { id: "core", label: "Core", kinds: ["home", "search"] },
  { id: "catalog", label: "Catalog", kinds: ["product", "collection", "collection_list"], requires: ["catalog"] },
  { id: "commerce", label: "Checkout", kinds: ["cart"], requires: ["commerce"] },
  { id: "services", label: "Services", kinds: ["service", "booking"], requires: ["booking"] },
  { id: "blog", label: "Blog", kinds: ["blog", "article"], requires: ["blog"] },
  { id: "pages", label: "Pages", kinds: ["page"] },
  { id: "account", label: "Customer accounts", kinds: ["account"], requires: ["accounts"] },
  { id: "system", label: "System", kinds: ["not_found", "password", "maintenance"] },
];

export type ViewEntry = {
  /** `template:<id>`, `page:<id>` or `group:<kind>` — the Studio route key. */
  key: string;
  documentId: string;
  label: string;
  description?: string;
  resourceKind?: ResourceKind;
  handle?: string;
  isSystem: boolean;
  hasUnpublishedChanges: boolean;
};

export type ViewIndex = {
  groups: { id: string; label: string; entries: ViewEntry[] }[];
  sectionGroups: ViewEntry[];
};

const dirty = (d: { draft: unknown; published: unknown }) =>
  d.published == null || JSON.stringify(d.draft) !== JSON.stringify(d.published);

export async function viewIndex(scope: Scope): Promise<ViewIndex> {
  const [s] = await db.select({ capabilities: site.capabilities }).from(site).where(eq(site.id, scope.siteId));
  if (!s) throw new NotFoundError("Site");
  const caps = new Set<string>(s.capabilities);

  const [templates, pages, groups] = await Promise.all([
    db
      .select({
        id: template.id,
        kind: template.resourceKind,
        handle: template.handle,
        name: template.name,
        isSystem: template.isSystem,
        documentId: template.documentId,
        draft: document.draftData,
        published: document.publishedData,
      })
      .from(template)
      .innerJoin(document, eq(document.id, template.documentId))
      .where(eq(template.siteId, scope.siteId))
      .orderBy(asc(template.handle), asc(template.name)),
    db
      .select({
        id: page.id,
        title: page.title,
        slug: page.slug,
        documentId: page.documentId,
        draft: document.draftData,
        published: document.publishedData,
      })
      .from(page)
      .innerJoin(document, eq(document.id, page.documentId))
      .where(eq(page.siteId, scope.siteId))
      .orderBy(asc(page.title)),
    db
      .select({
        kind: sectionGroup.kind,
        documentId: sectionGroup.documentId,
        draft: document.draftData,
        published: document.publishedData,
      })
      .from(sectionGroup)
      .innerJoin(document, eq(document.id, sectionGroup.documentId))
      .where(eq(sectionGroup.siteId, scope.siteId)),
  ]);

  const out: ViewIndex["groups"] = [];
  for (const g of viewGroups) {
    if (g.requires && !g.requires.some((c) => caps.has(c))) continue;
    const entries: ViewEntry[] = templates
      .filter((t) => g.kinds.includes(t.kind))
      .sort((a, b) => g.kinds.indexOf(a.kind) - g.kinds.indexOf(b.kind) || (a.handle === "default" ? -1 : 1))
      .map((t) => ({
        key: `template:${t.id}`,
        documentId: t.documentId,
        label: t.handle === "default" ? t.name : `${t.name} · ${t.handle}`,
        resourceKind: t.kind,
        handle: t.handle,
        isSystem: t.isSystem,
        hasUnpublishedChanges: dirty(t),
      }));
    if (g.id === "pages") {
      for (const p of pages) {
        entries.push({
          key: `page:${p.id}`,
          documentId: p.documentId!,
          label: p.title,
          description: `/${p.slug}`,
          isSystem: false,
          hasUnpublishedChanges: dirty(p),
        });
      }
    }
    if (entries.length) out.push({ id: g.id, label: g.label, entries });
  }

  const order = ["header", "footer", "overlay"];
  const sectionGroups = groups
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
    .map((g) => ({
      key: `group:${g.kind}`,
      documentId: g.documentId,
      label: g.kind[0]!.toUpperCase() + g.kind.slice(1),
      isSystem: true,
      hasUnpublishedChanges: dirty(g),
    }));

  return { groups: out, sectionGroups };
}

/** Resolves a Studio route key to its document (and checks it belongs to the site). */
export async function resolveView(scope: Scope, key: string): Promise<ViewEntry> {
  const index = await viewIndex(scope);
  const all = [...index.groups.flatMap((g) => g.entries), ...index.sectionGroups];
  const hit = all.find((e) => e.key === key);
  if (!hit) throw new NotFoundError("View");
  return hit;
}

/** Used by storefronts: which template document renders this resource. */
export async function templateDocumentId(siteId: string, kind: ResourceKind, handle = "default") {
  const [row] = await db
    .select({ documentId: template.documentId })
    .from(template)
    .where(and(eq(template.siteId, siteId), eq(template.resourceKind, kind), eq(template.handle, handle)))
    .limit(1);
  return row?.documentId ?? null;
}
