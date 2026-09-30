import { Elysia } from "elysia";
import { auth } from "../lib/auth";
import { resolveActor, resolveSite } from "../lib/tenancy";

/**
 * Derives `actor` (authenticated user, if any) and `site` (the tenant this
 * request acts on) for every downstream handler.
 *
 * Kept as a derive rather than a guard because storefront traffic is
 * legitimately anonymous; routes that need an admin call assertSiteAccess.
 */
export const tenancy = new Elysia({ name: "tenancy" })
  .derive({ as: "scoped" }, async ({ request }) => {
    const session = await auth.api
      .getSession({ headers: request.headers })
      .catch(() => null);

    const [actor, site] = await Promise.all([
      resolveActor(session?.user?.id),
      resolveSite(request.headers),
    ]);

    return { actor, site, session };
  })
  .as("scoped");
