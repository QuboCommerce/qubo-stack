import { Elysia } from "elysia";
import { db } from "@qubo/db/client";
import { order, product, siteCustomer } from "@qubo/db/schema";
import { and, count, eq, sql } from "drizzle-orm";
import { tenancy } from "../plugins/tenancy";
import { assertSiteAccess, listAccessibleSites } from "../lib/tenancy";

export const sites = new Elysia({ prefix: "/sites" })
  .use(tenancy)
  /** Powers the admin site switcher. */
  .get("/", async ({ actor, status }) => {
    if (!actor) return status(401, { error: "unauthenticated" });
    return { sites: await listAccessibleSites(actor) };
  })
  .get("/current", async ({ site, status }) => {
    if (!site) return status(400, { error: "site_not_resolved" });
    return { site };
  })
  .get("/current/stats", async ({ site, actor, status }) => {
    if (!site) return status(400, { error: "site_not_resolved" });
    if (!(await assertSiteAccess(actor, site))) {
      return status(403, { error: "forbidden" });
    }

    const [[products], [customers], [orders], [revenue]] = await Promise.all([
      db
        .select({ value: count() })
        .from(product)
        .where(eq(product.siteId, site.id)),
      db
        .select({ value: count() })
        .from(siteCustomer)
        .where(eq(siteCustomer.siteId, site.id)),
      db
        .select({ value: count() })
        .from(order)
        .where(eq(order.siteId, site.id)),
      db
        .select({ value: sql<string>`coalesce(sum(${order.total}), 0)` })
        .from(order)
        .where(
          and(
            eq(order.siteId, site.id),
            sql`${order.status} not in ('CANCELLED', 'REFUNDED')`,
          ),
        ),
    ]);

    return {
      site: site.slug,
      currency: site.currency,
      productCount: products.value,
      customerCount: customers.value,
      orderCount: orders.value,
      revenue: revenue.value,
    };
  });
