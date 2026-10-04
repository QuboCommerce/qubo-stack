import "server-only";
import { db } from "@qubo/db/client";
import { organizationMember, site, user } from "@qubo/db/schema";
import type { Audience } from "@qubo/realtime";
import { and, eq, inArray } from "drizzle-orm";
import { access } from "@qubo/portal-client";
import { auth } from "@/lib/auth";

export type Viewer = { user: { id: string; name: string; image: string | null }; sessionId: string; audience: Audience };

/**
 * The signed-in staff user + every site/org they're a member of. Null = not allowed.
 * Sites outside the plan are left out, so the route handlers and realtime streams
 * that authorise through `audience.siteIds` honour the same lock as requireSite.
 */
export async function viewerOf(headers: Headers): Promise<Viewer | null> {
  const session = await auth.api.getSession({ headers }).catch(() => null);
  if (!session?.user) return null;
  const [staff] = await db
    .select({ id: user.id, name: user.name, image: user.image })
    .from(user)
    .where(and(eq(user.id, session.user.id), inArray(user.role, ["ADMIN", "STAFF"])))
    .limit(1);
  if (!staff) return null;
  const [rows, licence] = await Promise.all([
    db
      .select({ siteId: site.id, orgId: organizationMember.organizationId })
      .from(organizationMember)
      .leftJoin(site, eq(site.organizationId, organizationMember.organizationId))
      .where(eq(organizationMember.userId, staff.id)),
    access(),
  ]);
  return {
    user: staff,
    sessionId: session.session.id,
    audience: {
      userId: staff.id,
      siteIds: new Set(rows.flatMap((r) => (r.siteId && !licence.lockedSiteIds.has(r.siteId) ? [r.siteId] : []))),
      orgIds: new Set(rows.flatMap((r) => (licence.lockedOrgIds.has(r.orgId) ? [] : [r.orgId]))),
    },
  };
}

export const audienceOf = async (headers: Headers) => (await viewerOf(headers))?.audience ?? null;
