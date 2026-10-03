import "server-only";
import { db } from "@qubo/db/client";
import { organizationMember, site, user } from "@qubo/db/schema";
import type { Audience } from "@qubo/realtime";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";

/** Who is asking for events: staff user + every site/org they're a member of. Null = not allowed. */
export async function audienceOf(headers: Headers): Promise<Audience | null> {
  const session = await auth.api.getSession({ headers }).catch(() => null);
  if (!session?.user) return null;
  const [staff] = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.id, session.user.id), inArray(user.role, ["ADMIN", "STAFF"])))
    .limit(1);
  if (!staff) return null;
  const rows = await db
    .select({ siteId: site.id, orgId: organizationMember.organizationId })
    .from(organizationMember)
    .leftJoin(site, eq(site.organizationId, organizationMember.organizationId))
    .where(eq(organizationMember.userId, staff.id));
  return {
    userId: staff.id,
    siteIds: new Set(rows.flatMap((r) => (r.siteId ? [r.siteId] : []))),
    orgIds: new Set(rows.map((r) => r.orgId)),
  };
}
