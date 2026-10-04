import { NextResponse, type NextRequest } from "next/server";
import { adminOrigin, previewSiteHost, requestHost } from "./lib/hosts";
import { GATE_PATH, PREVIEW_COOKIE, PREVIEW_HEADER, previewTokenLooksValid } from "./lib/preview";
import { siteHostFromAdminHost } from "@qubo/shared/admin-url";

/**
 * One app, many sites: every request is rewritten to `/sites/<host>/<path>`
 * so pages are keyed (and cacheable) per host. The host → site lookup itself
 * happens server-side in lib/site.ts.
 *
 * Preview hosts (`preview.<domain>`) are gated here, before any site code or
 * content is reached: no valid cookie → only the PIN page is served.
 */
export async function proxy(req: NextRequest) {
  const host = requestHost(req.headers);
  const { pathname, search } = req.nextUrl;

  // Admin hosts are served by qubo-admin; never render a storefront on them.
  if (!host || siteHostFromAdminHost(host)) return new NextResponse("Not found", { status: 404 });

  const siteHost = previewSiteHost(host);
  const preview = siteHost !== null;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return NextResponse.redirect(`${adminOrigin(siteHost ?? host)}${pathname.slice("/admin".length) || "/"}`, 302);
  }

  const headers = new Headers(req.headers);
  headers.set("x-qubo-host", siteHost ?? host);
  headers.set("x-qubo-path", `${pathname}${search}`);

  if (preview) {
    if (pathname === GATE_PATH) {
      // Reaching the gate always means "start over", so a stale cookie is dropped here.
      const res = NextResponse.next({ request: { headers } });
      res.cookies.delete(PREVIEW_COOKIE);
      return noindex(res);
    }
    const token = req.cookies.get(PREVIEW_COOKIE)?.value;
    if (!(await previewTokenLooksValid(token))) {
      const url = req.nextUrl.clone();
      url.pathname = GATE_PATH;
      url.search = pathname === "/" && !search ? "" : `?next=${encodeURIComponent(`${pathname}${search}`)}`;
      const res = NextResponse.rewrite(url, { request: { headers } });
      if (token) res.cookies.delete(PREVIEW_COOKIE);
      return noindex(res);
    }
    headers.set(PREVIEW_HEADER, token!);
  } else if (pathname === GATE_PATH) {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = req.nextUrl.clone();
  url.pathname = `/sites/${encodeURIComponent(siteHost ?? host)}${pathname === "/" ? "" : pathname}`;
  url.search = search;
  const res = NextResponse.rewrite(url, { request: { headers } });
  return preview ? noindex(res) : res;
}

function noindex(res: NextResponse) {
  res.headers.set("x-robots-tag", "noindex, nofollow");
  res.headers.set("cache-control", "private, no-store");
  return res;
}

export const config = {
  // Everything except Next internals and API routes (which are host-agnostic).
  matcher: ["/((?!_next/|api/).*)"],
};
