/**
 * Tells storefronts to drop cached pages after a publish. Target: the site's
 * own `QUBO_REVALIDATE_<SLUG>` (e.g. QUBO_REVALIDATE_HM_FROID), else the shared
 * `QUBO_REVALIDATE_URL` (qubo-storefront's /api/revalidate). The endpoint
 * accepts `POST { site, tags }` with `x-qubo-signature`. Unconfigured installs
 * are skipped — the storefront then relies on its cache TTL.
 */
import { createHmac } from "node:crypto";

export async function notifyRevalidate(siteSlug: string, tags: string[]) {
  const url =
    process.env[`QUBO_REVALIDATE_${siteSlug.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`] ?? process.env.QUBO_REVALIDATE_URL;
  const secret = process.env.QUBO_REVALIDATE_SECRET;
  if (!url || !secret) return { sent: false as const };
  const body = JSON.stringify({ site: siteSlug, tags });
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-qubo-signature": createHmac("sha256", secret).update(body).digest("hex"),
      },
      body,
      signal: AbortSignal.timeout(5000),
    });
    return { sent: true as const, ok: res.ok, status: res.status };
  } catch (error) {
    // Publishing must never fail because a storefront is down.
    console.warn("[qubo-studio] revalidate failed", siteSlug, error);
    return { sent: true as const, ok: false, status: 0 };
  }
}

export const documentTag = (documentId: string) => `document:${documentId}`;
export const themeTag = (siteId: string) => `theme:${siteId}`;
