import { db } from "@qubo/db/client";
import {
  organizationMember,
  site,
  siteDomain,
  user,
} from "@qubo/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { access } from "@qubo/portal-client";

export type SiteType = (typeof site.$inferSelect)["type"];

export type SiteContext = {
  id: string;
  slug: string;
  name: string;
  type: SiteType;
  currency: string;
  locale: string;
  organizationId: string;
  capabilities: SiteCapability[];
  /** null = draft; see `site.publishedAt`. */
  publishedAt: Date | null;
};

export type SiteCapability = (typeof site.$inferSelect)["capabilities"][number];

export type ActorContext = {
  id: string;
  email: string;
  role: string;
};

/**
 * Resolves which site a request is acting on.
 *
 * Order of precedence:
 *   1. `x-qubo-site` header  — used by qubo-admin's site switcher
 *   2. request hostname          — used by storefronts via store_domain
 *
 * Every tenant-scoped query must go through this. Trusting a caller-supplied
 * site id without the membership check in `assertSiteAccess` would let any
 * authenticated user read another tenant's catalogue.
 */
export async function resolveSite(
  headers: Headers,
): Promise<SiteContext | null> {
  const columns = {
    id: site.id,
    slug: site.slug,
    name: site.name,
    type: site.type,
    currency: site.currency,
    locale: site.locale,
    organizationId: site.organizationId,
    capabilities: site.capabilities,
    publishedAt: site.publishedAt,
  };

  const slug = headers.get("x-qubo-site")?.trim();
  if (slug) {
    const [row] = await db
      .select(columns)
      .from(site)
      .where(and(eq(site.slug, slug), isNull(site.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  const host = (headers.get("x-forwarded-host") ?? headers.get("host") ?? "")
    .split(":")[0]
    .replace(/^www\./, "")
    .toLowerCase();

  if (!host) return null;

  const [row] = await db
    .select(columns)
    .from(siteDomain)
    .innerJoin(site, eq(site.id, siteDomain.siteId))
    .where(and(eq(siteDomain.hostname, host), isNull(site.deletedAt)))
    .limit(1);

  return row ?? null;
}

/** Loads the acting user, or null for anonymous storefront traffic. */
export async function resolveActor(
  userId: string | undefined,
): Promise<ActorContext | null> {
  if (!userId) return null;

  const [row] = await db
    .select({ id: user.id, email: user.email, role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return row ?? null;
}

/**
 * Confirms the actor may administer the given site. Storefront reads do not
 * need this; anything that mutates or exposes back-office data does.
 */
export async function assertSiteAccess(
  actor: ActorContext | null,
  siteContext: SiteContext,
): Promise<boolean> {
  if (!actor) return false;
  if (!["ADMIN", "STAFF"].includes(actor.role)) return false;

  const [membership] = await db
    .select({ id: organizationMember.id })
    .from(organizationMember)
    .where(
      and(
        eq(organizationMember.userId, actor.id),
        eq(organizationMember.organizationId, siteContext.organizationId),
      ),
    )
    .limit(1);

  return Boolean(membership);
}

/**
 * Membership plus licence: sites outside the plan (see `access()` in
 * @qubo/portal-client) stay live on the storefront but can't be edited.
 * Use this for every back-office read or write; `assertSiteAccess` alone only
 * answers "is this person staff here".
 */
export async function assertSiteEditable(
  actor: ActorContext | null,
  siteContext: SiteContext,
): Promise<"ok" | "forbidden" | "locked"> {
  if (!(await assertSiteAccess(actor, siteContext))) return "forbidden";
  return (await access()).lockedSiteIds.has(siteContext.id) ? "locked" : "ok";
}

/** Every site the actor can switch between, for the admin site picker. */
export async function listAccessibleSites(actor: ActorContext) {
  return db
    .select({
      id: site.id,
      slug: site.slug,
      name: site.name,
      type: site.type,
      currency: site.currency,
      locale: site.locale,
      organizationId: site.organizationId,
    })
    .from(organizationMember)
    .innerJoin(
      site,
      eq(site.organizationId, organizationMember.organizationId),
    )
    .where(eq(organizationMember.userId, actor.id))
    .orderBy(site.name);
}
