import { db } from "@qubo/db/client";
import { siteSettings } from "@qubo/db/schema";
import { eq } from "drizzle-orm";

let cachedMaintenance: { value: boolean; timestamp: number } | null = null;
const CACHE_TTL = 30_000; // 30 seconds

export async function isMaintenanceMode(siteId?: string): Promise<boolean> {
  const now = Date.now();

  if (cachedMaintenance && now - cachedMaintenance.timestamp < CACHE_TTL) {
    return cachedMaintenance.value;
  }

  try {
    const settings = await db.query.siteSettings.findFirst({
      where: siteId ? eq(siteSettings.siteId, siteId) : undefined,
    });

    const isMaintenance = settings?.maintenanceMode ?? false;

    if (isMaintenance && settings?.maintenanceEnd) {
      const endDate = new Date(settings.maintenanceEnd);
      if (endDate < new Date()) {
        cachedMaintenance = { value: false, timestamp: now };
        return false;
      }
    }

    cachedMaintenance = { value: isMaintenance, timestamp: now };
    return isMaintenance;
  } catch {
    return false;
  }
}
