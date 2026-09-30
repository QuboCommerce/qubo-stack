"use server";

import { db } from "@peltier/db/client";
import { order, orderStatusHistory, product } from "@peltier/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSiteFromForm } from "@/lib/admin";

const idSchema = z.uuid();
const orderStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
]);

export async function toggleProductArchive(formData: FormData) {
  const { siteId, site } = await requireSiteFromForm(formData);
  const id = idSchema.parse(formData.get("id"));
  const archive = formData.get("archive") === "true";

  const [updated] = await db
    .update(product)
    .set({ isArchived: archive, updatedAt: new Date() })
    .where(and(eq(product.id, id), eq(product.siteId, siteId)))
    .returning({ id: product.id });

  if (!updated) throw new Error("Product not found on this site.");
  revalidatePath(`/${site.slug}/products`);
  revalidatePath(`/${site.slug}`);
}

export async function updateOrderStatus(formData: FormData) {
  const { siteId, site, user: currentUser } = await requireSiteFromForm(formData);
  const id = idSchema.parse(formData.get("id"));
  const status = orderStatusSchema.parse(formData.get("status"));

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ status: order.status })
      .from(order)
      .where(and(eq(order.id, id), eq(order.siteId, siteId)))
      .limit(1);

    if (!existing) throw new Error("Order not found on this site.");
    if (existing.status === status) return;

    const [updated] = await tx
      .update(order)
      .set({
        status,
        updatedAt: new Date(),
        cancelledAt: status === "CANCELLED" ? new Date() : null,
      })
      .where(
        and(
          eq(order.id, id),
          eq(order.siteId, siteId),
          eq(order.status, existing.status),
        ),
      )
      .returning({ id: order.id });

    if (!updated) throw new Error("The order changed meanwhile. Try again.");

    await tx.insert(orderStatusHistory).values({
      orderId: id,
      fromStatus: existing.status,
      toStatus: status,
      createdBy: currentUser.id,
    });
  });

  revalidatePath(`/${site.slug}/orders`);
  revalidatePath(`/${site.slug}`);
}
