import "server-only";

import { db } from "@qubo/db/client";
import { organizationMember, site, user } from "@qubo/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";

/** Staff user + the sites they can manage, from request headers; null for guests/customers. */
export async function staffFromHeaders(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (!session?.user) return null;
  const [staff] = await db
    .select({ id: user.id, name: user.name, email: user.email, image: user.image })
    .from(user)
    .where(and(eq(user.id, session.user.id), inArray(user.role, ["ADMIN", "STAFF"])))
    .limit(1);
  if (!staff) return null;
  const sites = await db
    .select({ id: site.id, slug: site.slug, name: site.name })
    .from(organizationMember)
    .innerJoin(site, eq(site.organizationId, organizationMember.organizationId))
    .where(eq(organizationMember.userId, staff.id));
  return { user: staff, sites };
}
