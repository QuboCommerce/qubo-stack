import "server-only";

import { db } from "@peltier/db/client";
import {
  order,
  product,
  productVariant,
  siteCustomer,
  user,
} from "@peltier/db/schema";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { requireAdminContext } from "@/lib/admin";

export async function getDashboardData() {
  const { siteId } = await requireAdminContext();
  const [[products], [customers], [orders], [revenue], recentOrders] =
    await Promise.all([
      db.select({ value: count() }).from(product).where(eq(product.siteId, siteId)),
      db.select({ value: count() }).from(siteCustomer).where(eq(siteCustomer.siteId, siteId)),
      db.select({ value: count() }).from(order).where(eq(order.siteId, siteId)),
      db
        .select({ value: sql<string>`coalesce(sum(${order.total}), 0)` })
        .from(order)
        .where(
          and(
            eq(order.siteId, siteId),
            sql`${order.status} not in ('CANCELLED', 'REFUNDED')`,
          ),
        ),
      getOrders(5),
    ]);

  return {
    productCount: products.value,
    customerCount: customers.value,
    orderCount: orders.value,
    revenue: revenue.value,
    recentOrders,
  };
}

export async function getProducts() {
  const { siteId } = await requireAdminContext();
  return db
    .select({
      id: product.id,
      name: product.name,
      brand: product.brand,
      basePrice: product.basePrice,
      isArchived: product.isArchived,
      variantCount: count(productVariant.id),
      updatedAt: product.updatedAt,
    })
    .from(product)
    .leftJoin(
      productVariant,
      and(
        eq(productVariant.productId, product.id),
        eq(productVariant.siteId, siteId),
      ),
    )
    .where(eq(product.siteId, siteId))
    .groupBy(product.id)
    .orderBy(desc(product.updatedAt))
    .limit(200);
}

export async function getCustomers() {
  const { siteId } = await requireAdminContext();
  return db
    .select({
      id: siteCustomer.id,
      firstName: siteCustomer.firstName,
      lastName: siteCustomer.lastName,
      email: siteCustomer.email,
      phone: siteCustomer.phone,
      company: siteCustomer.company,
      acceptsMarketing: siteCustomer.acceptsMarketing,
      createdAt: siteCustomer.createdAt,
    })
    .from(siteCustomer)
    .where(eq(siteCustomer.siteId, siteId))
    .orderBy(desc(siteCustomer.createdAt))
    .limit(200);
}

export async function getOrders(limit = 200) {
  const { siteId } = await requireAdminContext();
  return db
    .select({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: order.total,
      currency: order.currency,
      customerName: user.name,
      customerEmail: user.email,
      createdAt: order.createdAt,
    })
    .from(order)
    .leftJoin(user, eq(user.id, order.customerId))
    .where(eq(order.siteId, siteId))
    .orderBy(desc(order.createdAt))
    .limit(limit);
}
