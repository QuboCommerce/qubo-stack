"use server";

import { db } from "@qubo/db/client";
import { siteSettings } from "@qubo/db/schema";
import { generatePreviewPin } from "@qubo/studio";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireSiteFromForm } from "@/lib/admin";

/** The site's preview PIN, creating one the first time it is asked for. */
export async function getPreviewPin(siteId: string): Promise<string> {
  const row = await db.query.siteSettings.findFirst({ where: eq(siteSettings.siteId, siteId), columns: { previewPin: true } });
  if (row?.previewPin) return row.previewPin;
  const pin = generatePreviewPin();
  await db
    .insert(siteSettings)
    .values({ siteId, previewPin: pin })
    .onConflictDoUpdate({ target: siteSettings.siteId, set: { previewPin: pin, updatedAt: new Date() } });
  return pin;
}

/** New PIN; every open preview session stops working on its next request. */
export async function regeneratePreviewPin(formData: FormData) {
  const { siteId, site } = await requireSiteFromForm(formData);
  const pin = generatePreviewPin();
  await db
    .insert(siteSettings)
    .values({ siteId, previewPin: pin })
    .onConflictDoUpdate({ target: siteSettings.siteId, set: { previewPin: pin, updatedAt: new Date() } });
  revalidatePath(`/${site.slug}/settings/domains`);
}
