import "server-only";

import { db } from "@qubo/db/client";
import { asset, assetTag, site } from "@qubo/db/schema";
import { cleanFilename, mediaUrl } from "@qubo/storage";
import { and, eq } from "drizzle-orm";
import { siteForAdminHost } from "./admin-host";

/**
 * Library URL of a legacy product photo moved by `scripts/media/import-legacy-photos.ts`,
 * or null. Scoped to the org of the admin host's site when the host resolves; answers only
 * when exactly one imported file has that name, so a guess never crosses organisations.
 */
export async function importedLegacyPhotoUrl(filename: string, host: string | null) {
  const owner = host ? await siteForAdminHost(host).catch(() => null) : null;
  const org = owner ? (await db.select({ orgId: site.organizationId }).from(site).where(eq(site.id, owner.id)).limit(1))[0]?.orgId : undefined;
  const rows = await db
    .select({ id: asset.id, orgId: asset.organizationId, key: asset.key })
    .from(asset)
    .innerJoin(assetTag, and(eq(assetTag.assetId, asset.id), eq(assetTag.tag, "import:shopapplication")))
    .where(and(eq(asset.filename, cleanFilename(filename)), org ? eq(asset.organizationId, org) : undefined))
    .limit(2);
  if (rows.length !== 1) return null;
  const { id, orgId, key } = rows[0]!;
  return mediaUrl(orgId, id, key.slice(key.lastIndexOf(".") + 1));
}
