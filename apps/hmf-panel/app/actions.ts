"use server";

import { db } from "@hmf/db/client";
import { order, orderStatusHistory, product } from "@hmf/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminContext } from "@/lib/admin";

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
  const { storeId } = await requireAdminContext();
  const id = idSchema.parse(formData.get("id"));
  const archive = formData.get("archive") === "true";

  const [updated] = await db
    .update(product)
    .set({ isArchived: archive, updatedAt: new Date() })
    .where(and(eq(product.id, id), eq(product.storeId, storeId)))
    .returning({ id: product.id });

  if (!updated) throw new Error("Produit introuvable dans cette boutique.");
  revalidatePath("/products");
  revalidatePath("/");
}

export async function updateOrderStatus(formData: FormData) {
  const { storeId, user: currentUser } = await requireAdminContext();
  const id = idSchema.parse(formData.get("id"));
  const status = orderStatusSchema.parse(formData.get("status"));

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ status: order.status })
      .from(order)
      .where(and(eq(order.id, id), eq(order.storeId, storeId)))
      .limit(1);

    if (!existing) throw new Error("Commande introuvable dans cette boutique.");
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
          eq(order.storeId, storeId),
          eq(order.status, existing.status),
        ),
      )
      .returning({ id: order.id });

    if (!updated) throw new Error("La commande a été modifiée. Réessayez.");

    await tx.insert(orderStatusHistory).values({
      orderId: id,
      fromStatus: existing.status,
      toStatus: status,
      createdBy: currentUser.id,
    });
  });

  revalidatePath("/orders");
  revalidatePath("/");
}
