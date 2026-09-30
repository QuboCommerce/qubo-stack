import "server-only";
import { builtInThemes, type Theme } from "@peltier/stylekit";
import type { Capability, SiteType } from "@peltier/blocks";
import { getActiveTheme } from "@/lib/queries";

/** The theme to render with: an explicit built-in pack, else the site's published theme. */
export async function resolveCanvasTheme(siteId: string, override?: string): Promise<Theme> {
  if (override && override in builtInThemes) return builtInThemes[override as keyof typeof builtInThemes] as Theme;
  const row = await getActiveTheme(siteId);
  return ((row?.published ?? row?.draft) as Theme | undefined) ?? (Object.values(builtInThemes)[0] as Theme);
}

export function siteMeta(site: { id: string; type: string; capabilities: string[] | null; name: string }) {
  return {
    id: site.id,
    type: site.type as SiteType,
    capabilities: (site.capabilities ?? []) as Capability[],
    name: site.name,
  };
}
