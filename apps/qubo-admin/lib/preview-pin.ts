import "server-only";

import { db } from "@qubo/db/client";
import { siteSettings } from "@qubo/db/schema";
import { generatePreviewPin } from "@qubo/studio";
import { eq } from "drizzle-orm";

// Not a server action on purpose: anything exported from a "use server" file is callable from the browser.
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
