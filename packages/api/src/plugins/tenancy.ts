import { Elysia } from "elysia";
import { auth } from "../lib/auth";
import { previewGranted } from "../lib/preview";
import { assertSiteAccess, resolveActor, resolveSite, type SiteContext } from "../lib/tenancy";

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

    const [actor, resolved] = await Promise.all([
      resolveActor(session?.user?.id),
      resolveSite(request.headers),
    ]);

    // Draft sites don't exist for the public: only their staff, an unlocked
    // preview, or the PIN unlock itself may resolve them.
    let site: SiteContext | null = resolved;
    if (site && !site.publishedAt) {
      const allowed =
        new URL(request.url).pathname.endsWith("/render/preview/unlock") ||
        (await previewGranted(site.id, request.headers)) ||
        (await assertSiteAccess(actor, site));
      if (!allowed) site = null;
    }

    return { actor, site, session };
  })
  .as("scoped");
