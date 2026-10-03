import "server-only";

import { db } from "@qubo/db/client";
import { organizationMember, site, siteDomain, user } from "@qubo/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { siteUrl } from "@qubo/shared/site-url";
import { auth } from "@/lib/auth";

export const requireUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");

  const [authorizedUser] = await db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role, image: user.image })
    .from(user)
    .where(and(eq(user.id, session.user.id), inArray(user.role, ["ADMIN", "STAFF"])))
    .limit(1);

  if (!authorizedUser) redirect("/sign-in?error=forbidden");
  return authorizedUser;
});

/** Every site the user can reach through an organization membership. */
export const getUserSites = cache(async () => {
  const currentUser = await requireUser();
  const rows = await db
    .select({
      id: site.id,
      slug: site.slug,
      name: site.name,
      type: site.type,
      capabilities: site.capabilities,
      currency: site.currency,
      description: site.description,
      locale: site.locale,
      logo: site.logo,
      organizationId: site.organizationId,
      memberRole: organizationMember.role,
    })
    .from(organizationMember)
    .innerJoin(site, eq(site.organizationId, organizationMember.organizationId))
    .where(eq(organizationMember.userId, currentUser.id))
    .orderBy(asc(site.name));

  const domains = rows.length
    ? await db
        .select({ siteId: siteDomain.siteId, hostname: siteDomain.hostname, isPrimary: siteDomain.isPrimary, verifiedAt: siteDomain.verifiedAt })
        .from(siteDomain)
        .where(inArray(siteDomain.siteId, rows.map((r) => r.id)))
    : [];
  return rows.map((r) => {
    const own = domains.filter((d) => d.siteId === r.id);
    return {
      ...r,
      /** Primary domain as configured (may be unverified); for display only. */
      domain: own.find((d) => d.isPrimary)?.hostname ?? null,
      /** Where "View site" goes; null until the site has a reachable host. Never build this by hand. */
      url: siteUrl({ slug: r.slug, domains: own.map((d) => ({ hostname: d.hostname, isPrimary: d.isPrimary, verified: d.verifiedAt != null })) }),
    };
  });
});

export type AdminSite = Awaited<ReturnType<typeof getUserSites>>[number];

/** Resolves the site from the URL segment; 404 if the user isn't a member. */
export const requireSite = cache(async (slug: string) => {
  const [currentUser, sites] = await Promise.all([requireUser(), getUserSites()]);
  const current = sites.find((s) => s.slug === slug);
  if (!current) notFound();
  return { user: currentUser, site: current, sites, siteId: current.id };
});

/** Server actions receive the site slug from a hidden `site` field. */
export async function requireSiteFromForm(formData: FormData) {
  const slug = formData.get("site");
  if (typeof slug !== "string" || !slug) throw new Error("Missing site.");
  return requireSite(slug);
}
