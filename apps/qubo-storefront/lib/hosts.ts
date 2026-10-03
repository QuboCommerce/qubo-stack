/**
 * Host handling shared by the proxy (edge) and server components.
 * Kept dependency-free so it can run in the proxy runtime.
 */

/** Lowercased hostname without port, from the forwarded or direct Host header. */
export function requestHost(headers: Headers): string {
  const raw = headers.get("x-forwarded-host") ?? headers.get("host") ?? "";
  return raw.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}

/** `QUBO_DEV_SITE_HOSTS=qubo-web.by-ali.dev=hm-froid,localhost=hm-froid` → host → site slug. */
export function devSiteHosts(): Map<string, string> {
  const map = new Map<string, string>();
  for (const pair of (process.env.QUBO_DEV_SITE_HOSTS ?? "").split(",")) {
    const [host, slug] = pair.split("=").map((s) => s?.trim());
    if (host && slug) map.set(host.toLowerCase().replace(/:\d+$/, ""), slug);
  }
  return map;
}

/** The admin host for a storefront host: dev override, else `qubo.<domain>`. */
export function adminHostFor(host: string): string {
  const dev = (process.env.QUBO_ADMIN_HOSTS ?? "").split(",")[0]?.trim();
  return dev || `qubo.${host.replace(/^www\./, "")}`;
}
