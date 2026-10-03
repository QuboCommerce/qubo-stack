import { Elysia, t } from "elysia";
import { db } from "@qubo/db/client";
import { category, page, product, redirect, siteDomain } from "@qubo/db/schema";
import { and, asc, eq, isNotNull } from "drizzle-orm";
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
    const [products, categories, pages] = await Promise.all([
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
        .select({ slug: page.slug, updatedAt: page.updatedAt, isHomepage: page.isHomepage })
        .from(page)
        .where(and(eq(page.siteId, site.id), eq(page.state, "PUBLISHED"))),
    ]);
    return {
      products,
      categories,
      pages: pages.filter((p) => !p.isHomepage).map(({ slug, updatedAt }) => ({ slug, updatedAt })),
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
