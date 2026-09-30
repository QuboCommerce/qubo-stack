import "server-only";

import { db } from "@peltier/db/client";
import {
  organizationMember,
  site,
  user,
} from "@peltier/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";

export const requireAdminContext = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/sign-in");

  const [authorizedUser] = await db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role })
    .from(user)
    .where(
      and(
        eq(user.id, session.user.id),
        inArray(user.role, ["ADMIN", "STAFF"]),
      ),
    )
    .limit(1);

  if (!authorizedUser) redirect("/sign-in?error=forbidden");

  const [membership] = await db
    .select({
      siteId: site.id,
      siteName: site.name,
      currency: site.currency,
      organizationId: site.organizationId,
    })
    .from(organizationMember)
    .innerJoin(
      site,
      eq(site.organizationId, organizationMember.organizationId),
    )
    .where(eq(organizationMember.userId, authorizedUser.id))
    .orderBy(site.name)
    .limit(1);

  if (!membership) redirect("/sign-in?error=no-store");

  return { user: authorizedUser, ...membership };
});
