import "server-only";

import { db } from "@hmf/db/client";
import {
  order,
  product,
  productVariant,
  storeCustomer,
  user,
} from "@hmf/db/schema";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { requireAdminContext } from "@/lib/admin";

export async function getDashboardData() {
  const { storeId } = await requireAdminContext();
  const [[products], [customers], [orders], [revenue], recentOrders] =
    await Promise.all([
      db.select({ value: count() }).from(product).where(eq(product.storeId, storeId)),
      db.select({ value: count() }).from(storeCustomer).where(eq(storeCustomer.storeId, storeId)),
      db.select({ value: count() }).from(order).where(eq(order.storeId, storeId)),
      db
        .select({ value: sql<string>`coalesce(sum(${order.total}), 0)` })
        .from(order)
        .where(
          and(
            eq(order.storeId, storeId),
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
  const { storeId } = await requireAdminContext();
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
        eq(productVariant.storeId, storeId),
      ),
    )
    .where(eq(product.storeId, storeId))
    .groupBy(product.id)
    .orderBy(desc(product.updatedAt))
    .limit(200);
}

export async function getCustomers() {
  const { storeId } = await requireAdminContext();
  return db
    .select({
      id: storeCustomer.id,
      firstName: storeCustomer.firstName,
      lastName: storeCustomer.lastName,
      email: storeCustomer.email,
      phone: storeCustomer.phone,
      company: storeCustomer.company,
      acceptsMarketing: storeCustomer.acceptsMarketing,
      createdAt: storeCustomer.createdAt,
    })
    .from(storeCustomer)
    .where(eq(storeCustomer.storeId, storeId))
    .orderBy(desc(storeCustomer.createdAt))
    .limit(200);
}

export async function getOrders(limit = 200) {
  const { storeId } = await requireAdminContext();
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
    .where(eq(order.storeId, storeId))
    .orderBy(desc(order.createdAt))
    .limit(limit);
}
