import { cache } from "react";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db } from "@qubo/db/client";
import { conversation, organization, organizationMember, theme } from "@qubo/db/schema";
import { formatOklch, resolveRoleColor, ThemeSchema, type Theme } from "@qubo/stylekit";
import type { ShellAccess, ShellOrg, ShellSwatch } from "@/components/shell/types";
import { getAccess, requireUser } from "./admin";

/** Every organisation the user belongs to, empty ones included, oldest first. */
export const getUserOrgs = cache(async (): Promise<ShellOrg[]> => {
  const user = await requireUser();
  const licence = await getAccess();
  const rows = await db
    .select({
      id: organization.id,
      name: organization.name,
      legalName: organization.legalName,
      companyNumber: organization.companyNumber,
      role: organizationMember.role,
    })
    .from(organizationMember)
    .innerJoin(organization, eq(organization.id, organizationMember.organizationId))
    .where(eq(organizationMember.userId, user.id))
    .orderBy(asc(organization.createdAt));
  return rows.map((r) => ({ ...r, locked: licence.lockedOrgIds.has(r.id) }));
});

const FALLBACK: ShellSwatch = { background: "oklch(0.98 0.005 260)", primary: "oklch(0.55 0.2 260)", text: "oklch(0.2 0.02 260)", mode: "light" };

/** Three colours from each site's active theme, enough to paint a branded thumbnail. */
export async function getSiteSwatches(siteIds: string[]): Promise<Record<string, ShellSwatch>> {
  if (!siteIds.length) return {};
  const rows = await db
    .select({ siteId: theme.siteId, draft: theme.draft, published: theme.published })
    .from(theme)
    .where(and(inArray(theme.siteId, siteIds), eq(theme.isActive, true)));
  const out: Record<string, ShellSwatch> = {};
  for (const row of rows) {
    const parsed = ThemeSchema.safeParse(row.published ?? row.draft);
    if (!parsed.success) continue;
    const t: Theme = parsed.data;
    const scheme = t.schemes.find((s) => s.id === t.defaultScheme) ?? t.schemes[0];
    if (!scheme) continue;
    const mode = t.modeStrategy === "dark" ? "dark" : "light";
    const pick = (role: "background" | "primary" | "text") => {
      const c = resolveRoleColor(t, scheme, mode, role);
      return c ? formatOklch(c) : FALLBACK[role];
    };
    out[row.siteId] = { background: pick("background"), primary: pick("primary"), text: pick("text"), mode };
  }
  return out;
}

/** Unread, still-open conversations per site, for the badges on the switcher cards. */
export async function getUnreadBySite(siteIds: string[]): Promise<Record<string, number>> {
  if (!siteIds.length) return {};
  const rows = await db
    .select({ siteId: conversation.siteId, value: count() })
    .from(conversation)
    .where(and(inArray(conversation.siteId, siteIds), eq(conversation.unread, true), inArray(conversation.status, ["open", "pending"])))
    .groupBy(conversation.siteId);
  return Object.fromEntries(rows.map((r) => [r.siteId, r.value]));
}

export async function getShellAccess(): Promise<ShellAccess> {
  const a = await getAccess();
  return {
    plan: a.entitlements.plan,
    sites: { used: a.sites.used, limit: a.sites.limit, canCreate: a.sites.canCreate },
    orgs: { used: a.orgs.used, limit: a.orgs.limit, canCreate: a.orgs.canCreate },
  };
}
