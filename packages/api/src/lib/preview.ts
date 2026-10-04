import { db } from "@qubo/db/client";
import { siteSettings } from "@qubo/db/schema";
import * as studio from "@qubo/studio";
import { eq } from "drizzle-orm";

/**
 * Site preview (`preview.<domain>`): the storefront forwards the visitor's
 * unlocked token as `x-qubo-preview`; when it checks out, render routes serve
 * drafts. Anything else (missing, forged, PIN regenerated) is plain published.
 */
export async function previewGranted(siteId: string, headers: Record<string, string | undefined> | Headers): Promise<boolean> {
  const token = headers instanceof Headers ? headers.get("x-qubo-preview") : headers["x-qubo-preview"];
  if (!token) return false;
  const settings = await db.query.siteSettings.findFirst({ where: eq(siteSettings.siteId, siteId), columns: { previewPin: true } });
  return studio.verifySitePreviewToken(token, { id: siteId, pin: settings?.previewPin ?? null });
}
