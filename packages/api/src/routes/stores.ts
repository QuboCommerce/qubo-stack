import { Elysia } from "elysia";
import { db } from "@peltier/db/client";
import { order, product, storeCustomer } from "@peltier/db/schema";
import { and, count, eq, sql } from "drizzle-orm";
import { tenancy } from "../plugins/tenancy";
import { assertStoreAccess, listAccessibleStores } from "../lib/tenancy";

export const stores = new Elysia({ prefix: "/stores" })
  .use(tenancy)
  /** Powers the admin store switcher. */
  .get("/", async ({ actor, status }) => {
    if (!actor) return status(401, { error: "unauthenticated" });
    return { stores: await listAccessibleStores(actor) };
  })
  .get("/current", async ({ store, status }) => {
    if (!store) return status(400, { error: "store_not_resolved" });
    return { store };
  })
  .get("/current/stats", async ({ store, actor, status }) => {
    if (!store) return status(400, { error: "store_not_resolved" });
    if (!(await assertStoreAccess(actor, store))) {
      return status(403, { error: "forbidden" });
    }

    const [[products], [customers], [orders], [revenue]] = await Promise.all([
      db
        .select({ value: count() })
        .from(product)
        .where(eq(product.storeId, store.id)),
      db
        .select({ value: count() })
        .from(storeCustomer)
        .where(eq(storeCustomer.storeId, store.id)),
      db
        .select({ value: count() })
        .from(order)
        .where(eq(order.storeId, store.id)),
      db
        .select({ value: sql<string>`coalesce(sum(${order.total}), 0)` })
        .from(order)
        .where(
          and(
            eq(order.storeId, store.id),
            sql`${order.status} not in ('CANCELLED', 'REFUNDED')`,
          ),
        ),
    ]);

    return {
      store: store.slug,
      currency: store.currency,
      productCount: products.value,
      customerCount: customers.value,
      orderCount: orders.value,
      revenue: revenue.value,
    };
  });
