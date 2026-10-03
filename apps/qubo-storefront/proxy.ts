import { NextResponse, type NextRequest } from "next/server";
import { adminHostFor, requestHost } from "./lib/hosts";

/**
 * One app, many sites: every request is rewritten to `/sites/<host>/<path>`
 * so pages are keyed (and cacheable) per host. The host → site lookup itself
 * happens server-side in lib/site.ts.
 */
export function proxy(req: NextRequest) {
  const host = requestHost(req.headers);
  const { pathname, search } = req.nextUrl;

  // Admin hosts are served by qubo-admin; never render a storefront on them.
  if (!host || host.startsWith("qubo.")) return new NextResponse("Not found", { status: 404 });

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return NextResponse.redirect(`https://${adminHostFor(host)}${pathname.slice("/admin".length) || "/"}`, 302);
  }

  const headers = new Headers(req.headers);
  headers.set("x-qubo-host", host);
  headers.set("x-qubo-path", `${pathname}${search}`);
  const url = req.nextUrl.clone();
  url.pathname = `/sites/${encodeURIComponent(host)}${pathname === "/" ? "" : pathname}`;
  url.search = search;
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  // Everything except Next internals and API routes (which are host-agnostic).
  matcher: ["/((?!_next/|api/).*)"],
};
