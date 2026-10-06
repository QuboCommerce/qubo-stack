import { page, sectionGroup, site, siteLocale, template, translation } from "@qubo/db/schema";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import type { Capability } from "@qubo/blocks";
import { document } from "@qubo/db/schema";
import { sameContent } from "./content";
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

const dirty = (d: { draft: unknown; published: unknown }) => d.published == null || !sameContent(d.draft, d.published);

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

export type SectionGroupKind = (typeof sectionGroup.$inferSelect)["kind"];

/** Used by storefronts: the document behind a site-wide section group (header, footer). */
export async function sectionGroupDocumentId(siteId: string, kind: SectionGroupKind) {
  const [row] = await db
    .select({ documentId: sectionGroup.documentId })
    .from(sectionGroup)
    .where(and(eq(sectionGroup.siteId, siteId), eq(sectionGroup.kind, kind)))
    .limit(1);
  return row?.documentId ?? null;
}

/** Used by storefronts: a published standalone page by slug (`""` = homepage). Site preview also sees drafts. */
export const PAGE_FIELDS = ["title", "metaTitle", "metaDescription", "slug"] as const;
export type PageField = (typeof PAGE_FIELDS)[number];

export type PublishedPage = {
  id: string;
  documentId: string;
  /** Slug in the requested locale (the primary slug when none is translated). */
  slug: string;
  primarySlug: string;
  title: string;
  metaTitle: string | null;
  metaDescription: string | null;
  /** Slug per published locale, the primary one included, for hreflang and the language switch. */
  slugs: Record<string, string>;
};

/** Translation overlays of a page's own fields (`page:<id>` rows): `{ "nl-BE": { title, slug } }`. */
async function pageOverlays(siteId: string, pageId: string): Promise<Record<string, Partial<Record<PageField, string>>>> {
  const rows = await db
    .select({ locale: translation.locale, path: translation.path, value: translation.value })
    .from(translation)
    .where(and(eq(translation.siteId, siteId), eq(translation.ownerRef, `page:${pageId}`)));
  const out: Record<string, Partial<Record<PageField, string>>> = {};
  for (const r of rows) {
    if (!(PAGE_FIELDS as readonly string[]).includes(r.path)) continue;
    (out[r.locale] ??= {})[r.path as PageField] = r.value;
  }
  return out;
}

async function publishedLocales(siteId: string) {
  const rows = await db
    .select({ locale: siteLocale.locale, isPrimary: siteLocale.isPrimary, isPublished: siteLocale.isPublished })
    .from(siteLocale)
    .where(eq(siteLocale.siteId, siteId));
  return { primary: rows.find((l) => l.isPrimary)?.locale ?? null, published: rows.filter((l) => l.isPrimary || l.isPublished).map((l) => l.locale) };
}

/**
 * A published page by slug. In a secondary locale the slug is matched against
 * that locale's translated slug first, then the primary slug (so old links
 * still resolve and the storefront can redirect to the translated one).
 */
export async function publishedPage(siteId: string, slug: string, opts: { includeDrafts?: boolean; locale?: string } = {}): Promise<PublishedPage | null> {
  const state = opts.includeDrafts ? ne(page.state, "ARCHIVED") : eq(page.state, "PUBLISHED");
  const select = { id: page.id, documentId: page.documentId, slug: page.slug, title: page.title, metaTitle: page.metaTitle, metaDescription: page.metaDescription };
  type Row = { id: string; documentId: string | null; slug: string; title: string; metaTitle: string | null; metaDescription: string | null };
  let row: Row | undefined;
  if (slug && opts.locale) {
    const [hit] = await db
      .select(select)
      .from(page)
      .innerJoin(translation, and(eq(translation.ownerRef, sql`'page:' || ${page.id}`), eq(translation.path, "slug"), eq(translation.locale, opts.locale)))
      .where(and(eq(page.siteId, siteId), eq(translation.value, slug), state))
      .limit(1);
    row = hit;
  }
  if (!row) {
    const [hit] = await db
      .select(select)
      .from(page)
      .where(and(eq(page.siteId, siteId), slug ? eq(page.slug, slug) : eq(page.isHomepage, true), state))
      .limit(1);
    row = hit;
  }
  if (!row?.documentId) return null;
  const [overlays, locales] = await Promise.all([pageOverlays(siteId, row.id), publishedLocales(siteId)]);
  const own = opts.locale && opts.locale !== locales.primary ? (overlays[opts.locale] ?? {}) : {};
  const slugs: Record<string, string> = {};
  for (const l of locales.published) slugs[l] = (l === locales.primary ? undefined : overlays[l]?.slug) ?? row.slug;
  return {
    id: row.id,
    documentId: row.documentId,
    slug: own.slug ?? row.slug,
    primarySlug: row.slug,
    title: own.title ?? row.title,
    // A translated title must not be shadowed by the primary language's meta title.
    metaTitle: own.metaTitle ?? (own.title ? null : row.metaTitle),
    metaDescription: own.metaDescription ?? (own.title ? null : row.metaDescription),
    slugs,
  };
}
