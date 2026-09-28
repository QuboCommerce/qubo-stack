import { db } from "@peltier/db/client";
import {
  organizationMember,
  store,
  storeDomain,
  user,
} from "@peltier/db/schema";
import { and, eq } from "drizzle-orm";

export type StoreContext = {
  id: string;
  slug: string;
  name: string;
  currency: string;
  locale: string;
  organizationId: string;
};

export type ActorContext = {
  id: string;
  email: string;
  role: string;
};

/**
 * Resolves which store a request is acting on.
 *
 * Order of precedence:
 *   1. `x-peltier-store` header  — used by peltier-admin's store switcher
 *   2. request hostname          — used by storefronts via store_domain
 *
 * Every tenant-scoped query must go through this. Trusting a caller-supplied
 * store id without the membership check in `assertStoreAccess` would let any
 * authenticated user read another tenant's catalogue.
 */
export async function resolveStore(
  headers: Headers,
): Promise<StoreContext | null> {
  const columns = {
    id: store.id,
    slug: store.slug,
    name: store.name,
    currency: store.currency,
    locale: store.locale,
    organizationId: store.organizationId,
  };

  const slug = headers.get("x-peltier-store")?.trim();
  if (slug) {
    const [row] = await db
      .select(columns)
      .from(store)
      .where(eq(store.slug, slug))
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
    .from(storeDomain)
    .innerJoin(store, eq(store.id, storeDomain.storeId))
    .where(eq(storeDomain.hostname, host))
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
 * Confirms the actor may administer the given store. Storefront reads do not
 * need this; anything that mutates or exposes back-office data does.
 */
export async function assertStoreAccess(
  actor: ActorContext | null,
  storeContext: StoreContext,
): Promise<boolean> {
  if (!actor) return false;
  if (!["ADMIN", "STAFF"].includes(actor.role)) return false;

  const [membership] = await db
    .select({ id: organizationMember.id })
    .from(organizationMember)
    .where(
      and(
        eq(organizationMember.userId, actor.id),
        eq(organizationMember.organizationId, storeContext.organizationId),
      ),
    )
    .limit(1);

  return Boolean(membership);
}

/** Every store the actor can switch between, for the admin store picker. */
export async function listAccessibleStores(actor: ActorContext) {
  return db
    .select({
      id: store.id,
      slug: store.slug,
      name: store.name,
      currency: store.currency,
      locale: store.locale,
      organizationId: store.organizationId,
    })
    .from(organizationMember)
    .innerJoin(
      store,
      eq(store.organizationId, organizationMember.organizationId),
    )
    .where(eq(organizationMember.userId, actor.id))
    .orderBy(store.name);
}
