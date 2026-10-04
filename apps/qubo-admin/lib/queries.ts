import "server-only";

import { db } from "@qubo/db/client";
import {
  conversation,
  document,
  order,
  organizationMember,
  siteDomain,
  product,
  productCategory,
  productImage,
  productVariant,
  siteCustomer,
  siteLocale,
  template,
  theme,
  user,
} from "@qubo/db/schema";
import { and, count, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";

export async function getDashboardData(siteId: string) {
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
      getOrders(siteId, 6),
    ]);

  return {
    productCount: products.value,
    customerCount: customers.value,
    orderCount: orders.value,
    revenue: revenue.value,
    recentOrders,
  };
}

/** `categoryIds` matches products in any of the ids (pass a whole subtree); "none" matches uncategorised products. */
export type ProductFilter = { q?: string; status?: "active" | "archived" | "all"; categoryIds?: string[] | "none"; page?: number; perPage?: number };

export async function getProducts(siteId: string, filter: ProductFilter = {}) {
  const perPage = filter.perPage ?? 50;
  const page = Math.max(1, filter.page ?? 1);
  const conds = [eq(product.siteId, siteId)];
  if (filter.status === "active") conds.push(eq(product.isArchived, false));
  if (filter.status === "archived") conds.push(eq(product.isArchived, true));
  if (filter.q?.trim()) {
    const q = `%${filter.q.trim()}%`;
    conds.push(sql`(${product.name} ilike ${q} or ${product.slug} ilike ${q} or ${product.brand} ilike ${q})`);
  }
  if (filter.categoryIds === "none") {
    conds.push(sql`not exists (select 1 from ${productCategory} pc where pc.product_id = "product"."id")`);
  } else if (filter.categoryIds) {
    const ids = filter.categoryIds.length ? filter.categoryIds : ["00000000-0000-0000-0000-000000000000"];
    conds.push(
      sql`exists (select 1 from ${productCategory} pc where pc.product_id = "product"."id" and pc.category_id in (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)}))`,
    );
  }
  const where = and(...conds);
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: product.id,
        name: product.name,
        slug: product.slug,
        brand: product.brand,
        basePrice: product.basePrice,
        isArchived: product.isArchived,
        variantCount: sql<number>`(select count(*)::int from ${productVariant} v where v.product_id = "product"."id")`,
        inventory: sql<number | null>`(select sum(ii.quantity)::int from ${productVariant} v join inventory_item ii on ii.variant_id = v.id where v.product_id = "product"."id")`,
        image: sql<string | null>`(select pi.url from ${productImage} pi where pi.product_id = "product"."id" order by pi.position limit 1)`,
        updatedAt: product.updatedAt,
      })
      .from(product)
      .where(where)
      .orderBy(desc(product.updatedAt), product.name)
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.select({ value: count() }).from(product).where(where),
  ]);
  return { rows, total: total?.value ?? 0, page, perPage };
}

export async function getCustomers(siteId: string, filter: { q?: string; page?: number; perPage?: number } = {}) {
  const perPage = filter.perPage ?? 50;
  const page = Math.max(1, filter.page ?? 1);
  const conds = [eq(siteCustomer.siteId, siteId)];
  if (filter.q?.trim()) {
    const q = `%${filter.q.trim()}%`;
    conds.push(
      sql`(${siteCustomer.email} ilike ${q} or ${siteCustomer.firstName} ilike ${q} or ${siteCustomer.lastName} ilike ${q} or ${siteCustomer.company} ilike ${q})`,
    );
  }
  const where = and(...conds);
  const [rows, [total]] = await Promise.all([
    db
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
      .where(where)
      .orderBy(desc(siteCustomer.createdAt), siteCustomer.lastName)
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.select({ value: count() }).from(siteCustomer).where(where),
  ]);
  return { rows, total: total?.value ?? 0, page, perPage };
}

export async function getOrders(siteId: string, limit = 200) {
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

/** Sidebar badges: open orders and unread inbox conversations. */
export async function getShellCounts(siteId: string) {
  const [[orders], [inbox]] = await Promise.all([
    db
      .select({ value: count() })
      .from(order)
      .where(and(eq(order.siteId, siteId), inArray(order.status, ["PENDING", "CONFIRMED", "PROCESSING"]))),
    db
      .select({ value: count() })
      .from(conversation)
      .where(and(eq(conversation.siteId, siteId), eq(conversation.unread, true), ne(conversation.status, "resolved"))),
  ]);
  return { orders: orders?.value ?? 0, inbox: inbox?.value ?? 0 };
}

/** Daily sales for the last `days` days (zero-filled). */
export async function getSalesSeries(siteId: string, days = 30) {
  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${order.createdAt}), 'YYYY-MM-DD')`,
      sales: sql<string>`coalesce(sum(${order.total}), 0)`,
      orders: count(),
    })
    .from(order)
    .where(
      and(
        eq(order.siteId, siteId),
        gte(order.createdAt, sql`now() - make_interval(days => ${days})`),
        sql`${order.status} not in ('CANCELLED', 'REFUNDED')`,
      ),
    )
    .groupBy(sql`1`);
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const out: { day: string; sales: number; orders: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    const r = byDay.get(d);
    out.push({ day: d, sales: r ? Number(r.sales) : 0, orders: r?.orders ?? 0 });
  }
  return out;
}

export async function getCatalogHealth(siteId: string) {
  const [[stats]] = await Promise.all([
    db
      .select({
        total: count(),
        active: sql<number>`count(*) filter (where not ${product.isArchived})::int`,
        withImage: sql<number>`count(*) filter (where exists (select 1 from ${productImage} pi where pi.product_id = "product"."id"))::int`,
        withBrand: sql<number>`count(*) filter (where ${product.brand} is not null and ${product.brand} <> '')::int`,
        categorized: sql<number>`count(*) filter (where exists (select 1 from ${productCategory} pc where pc.product_id = "product"."id"))::int`,
      })
      .from(product)
      .where(eq(product.siteId, siteId)),
  ]);
  return stats!;
}

export async function getActiveTheme(siteId: string) {
  const [row] = await db
    .select()
    .from(theme)
    .where(and(eq(theme.siteId, siteId), eq(theme.isActive, true)))
    .limit(1);
  return row ?? null;
}

export async function getTemplates(siteId: string) {
  return db
    .select({
      id: template.id,
      kind: template.resourceKind,
      handle: template.handle,
      name: template.name,
      isSystem: template.isSystem,
      updatedAt: document.updatedAt,
      publishedAt: document.publishedAt,
      draftVersion: document.draftVersion,
    })
    .from(template)
    .innerJoin(document, eq(document.id, template.documentId))
    .where(eq(template.siteId, siteId))
    .orderBy(template.isSystem, template.name);
}

export async function getLocales(siteId: string) {
  return db.select().from(siteLocale).where(eq(siteLocale.siteId, siteId)).orderBy(desc(siteLocale.isPrimary), siteLocale.locale);
}

export async function getDomains(siteId: string) {
  return db.select().from(siteDomain).where(eq(siteDomain.siteId, siteId)).orderBy(desc(siteDomain.isPrimary), siteDomain.hostname);
}

export async function getMembers(organizationId: string) {
  return db
    .select({ id: organizationMember.id, role: organizationMember.role, since: organizationMember.createdAt, name: user.name, email: user.email, image: user.image })
    .from(organizationMember)
    .innerJoin(user, eq(user.id, organizationMember.userId))
    .where(eq(organizationMember.organizationId, organizationId))
    .orderBy(organizationMember.role, user.name);
}
