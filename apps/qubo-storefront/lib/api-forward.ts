const FORWARD_REQUEST = ["cookie", "content-type", "origin", "referer", "user-agent", "accept-language", "x-forwarded-for"];

/**
 * Forwards a visitor request to qubo-api for `slug`, keeping the public host
 * (`x-forwarded-host/proto`) so the API sees the site's own origin, and passing
 * `set-cookie` back so session cookies are host-only on the storefront domain.
 */
export async function forwardToApi(req: Request, slug: string, path: string): Promise<Response> {
  const base = (process.env.QUBO_API_URL ?? "http://localhost:3333").replace(/\/$/, "");
  const headers = new Headers({ "x-qubo-site": slug });
  for (const name of FORWARD_REQUEST) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  const url = new URL(req.url);
  headers.set("x-forwarded-host", (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host).split(",")[0].trim());
  headers.set("x-forwarded-proto", (req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "")).split(",")[0].trim());

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const upstream = await fetch(`${base}${path}${url.search}`, {
    method: req.method,
    headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
    redirect: "manual",
    cache: "no-store",
  });

  const out = new Headers({ "cache-control": "no-store" });
  for (const name of ["content-type", "location"]) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  for (const cookie of upstream.headers.getSetCookie()) out.append("set-cookie", cookie);
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
