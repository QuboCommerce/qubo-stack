import { Elysia, t } from "elysia";
import { db } from "@qubo/db/client";
import { category, page, product, redirect, siteDomain, translation } from "@qubo/db/schema";
import { and, asc, eq, inArray, isNotNull, like } from "drizzle-orm";
import { tenancy } from "../plugins/tenancy";

/**
 * Anonymous SEO reads for storefronts: the site's public domains (canonical
 * host), every indexable URL (sitemap) and legacy redirects.
 */
export const seo = new Elysia({ prefix: "/render" })
  .use(tenancy)
  .get("/domains", async ({ site, status }) => {
    if (!site) return status(400, { error: "site_not_resolved" });
    const rows = await db
      .select({ hostname: siteDomain.hostname, isPrimary: siteDomain.isPrimary })
      .from(siteDomain)
      .where(and(eq(siteDomain.siteId, site.id), isNotNull(siteDomain.verifiedAt)));
    const primary = rows.find((d) => d.isPrimary) ?? rows[0];
    return { primary: primary?.hostname ?? null, verified: rows.map((d) => d.hostname) };
  })
  .get("/sitemap", async ({ site, status }) => {
    if (!site) return status(400, { error: "site_not_resolved" });
    const [products, categories, pages, pageSlugs] = await Promise.all([
      db
        .select({ slug: product.slug, updatedAt: product.updatedAt })
        .from(product)
        .where(and(eq(product.siteId, site.id), eq(product.isArchived, false)))
        .orderBy(asc(product.slug)),
      db
        .select({ slug: category.slug, updatedAt: category.updatedAt })
        .from(category)
        .where(eq(category.siteId, site.id))
        .orderBy(asc(category.position)),
      db
        .select({ id: page.id, slug: page.slug, title: page.title, updatedAt: page.updatedAt, isHomepage: page.isHomepage })
        .from(page)
        .where(and(eq(page.siteId, site.id), eq(page.state, "PUBLISHED")))
        .orderBy(asc(page.title)),
      // Translated slugs and titles per locale (`page:<id>` rows), for hreflang and localized trees.
      db
        .select({ ownerRef: translation.ownerRef, path: translation.path, locale: translation.locale, value: translation.value })
        .from(translation)
        .where(and(eq(translation.siteId, site.id), like(translation.ownerRef, "page:%"), inArray(translation.path, ["slug", "title"]))),
    ]);
    const perPage = new Map<string, Record<string, { slug?: string; title?: string }>>();
    for (const t of pageSlugs) {
      const id = t.ownerRef.slice("page:".length);
      const byLocale = perPage.get(id) ?? {};
      (byLocale[t.locale] ??= {})[t.path as "slug" | "title"] = t.value;
      perPage.set(id, byLocale);
    }
    return {
      products,
      categories,
      pages: pages.filter((p) => !p.isHomepage).map(({ id, slug, title, updatedAt }) => ({ slug, title, updatedAt, locales: perPage.get(id) ?? {} })),
    };
  })
  .get(
    "/redirect",
    async ({ site, query, status }) => {
      if (!site) return status(400, { error: "site_not_resolved" });
      const [row] = await db
        .select({ to: redirect.toPath, status: redirect.statusCode })
        .from(redirect)
        .where(and(eq(redirect.siteId, site.id), eq(redirect.fromPath, query.path)))
        .limit(1);
      return row ?? status(404, { error: "not_found" });
    },
    { query: t.Object({ path: t.String() }) },
  );
