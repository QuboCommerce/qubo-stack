import { Elysia } from "elysia";
import { db } from "@qubo/db/client";
import { order as orderTable, orderItem, siteCustomer } from "@qubo/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { tenancy } from "../plugins/tenancy";

/**
 * Signed-in customer's view of one site: profile and that site's orders.
 *
 * Orders are matched by `customer_id` (set at checkout from the session), never
 * by email: sign-up does not verify email yet, so an email match would let
 * anyone read a legacy customer's orders by registering their address.
 */
export const account = new Elysia().use(tenancy).get("/account", async ({ site, session, status }) => {
  if (!site) return status(400, { error: "site_not_resolved" });
  if (!site.capabilities.includes("accounts")) return status(404, { error: "not_found" });
  if (!session) return status(401, { error: "unauthorized" });
  const user = session.user;

  // Register the user as a customer of this site on first visit (no-op when the email is already known).
  const [first, ...rest] = (user.name ?? "").trim().split(/\s+/);
  await db
    .insert(siteCustomer)
    .values({ siteId: site.id, userId: user.id, email: user.email.toLowerCase(), firstName: first || null, lastName: rest.join(" ") || null })
    .onConflictDoNothing();

  const orders = await db
    .select({
      id: orderTable.id,
      number: orderTable.orderNumber,
      status: orderTable.status,
      total: orderTable.total,
      currency: orderTable.currency,
      createdAt: orderTable.createdAt,
    })
    .from(orderTable)
    .where(and(eq(orderTable.siteId, site.id), eq(orderTable.customerId, user.id)))
    .orderBy(desc(orderTable.createdAt))
    .limit(50);

  const items = orders.length
    ? await db
        .select({ orderId: orderItem.orderId, name: orderItem.productName, variant: orderItem.variantName, quantity: orderItem.quantity })
        .from(orderItem)
        .where(inArray(orderItem.orderId, orders.map((o) => o.id)))
    : [];

  return {
    user: { name: user.name, email: user.email },
    orders: orders.map((o) => ({
      number: o.number,
      status: o.status,
      total: o.total,
      currency: o.currency,
      createdAt: o.createdAt.toISOString(),
      items: items.filter((i) => i.orderId === o.id).map(({ name, variant, quantity }) => ({ name, variant, quantity })),
    })),
  };
});
