/**
 * Tells storefronts to drop cached pages after a publish. Each site may set
 * `PELTIER_REVALIDATE_<SLUG>` (e.g. PELTIER_REVALIDATE_HM_FROID) to a URL that
 * accepts `POST { tags: string[] }` with `x-peltier-signature`. Unconfigured
 * sites are skipped — the storefront then relies on its own ISR window.
 */
import { createHmac } from "node:crypto";

export async function notifyRevalidate(siteSlug: string, tags: string[]) {
  const url = process.env[`PELTIER_REVALIDATE_${siteSlug.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`];
  const secret = process.env.PELTIER_REVALIDATE_SECRET;
  if (!url || !secret) return { sent: false as const };
  const body = JSON.stringify({ tags });
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-peltier-signature": createHmac("sha256", secret).update(body).digest("hex"),
      },
      body,
      signal: AbortSignal.timeout(5000),
    });
    return { sent: true as const, ok: res.ok, status: res.status };
  } catch (error) {
    // Publishing must never fail because a storefront is down.
    console.warn("[peltier-studio] revalidate failed", siteSlug, error);
    return { sent: true as const, ok: false, status: 0 };
  }
}

export const documentTag = (documentId: string) => `document:${documentId}`;
export const themeTag = (siteId: string) => `theme:${siteId}`;
