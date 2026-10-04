import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { API_VERSION } from "@qubo/storefront";
import { signClientIp } from "@qubo/shared/client-ip";
import { previewSiteHost, requestHost, siteTargets } from "@/lib/hosts";
import { PREVIEW_COOKIE, PREVIEW_HEADER } from "@/lib/preview";

/** httpOnly, so page scripts never see the token that unlocks the visitor's chat. */
export const CHAT_COOKIE = "qb_chat";
const CHAT_TOKEN_HEADER = "x-qubo-chat-token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

/**
 * Forwards a chat call to qubo-api for the site on this host (preview hosts
 * included), with the session cookie, the chat token and the signed visitor IP.
 * `mintToken`: give a first-time visitor a token (only when they send a message).
 */
export async function forwardChat(req: NextRequest, path: "" | "/messages" | "/stream", opts: { mintToken?: boolean } = {}): Promise<Response> {
  const host = requestHost(req.headers);
  const previewOf = previewSiteHost(host);
  const siteHost = previewOf ?? host;
  const existing = req.cookies.get(CHAT_COOKIE)?.value;
  const token = existing ?? (opts.mintToken ? randomBytes(32).toString("base64url") : undefined);
  const preview = previewOf ? req.cookies.get(PREVIEW_COOKIE)?.value : undefined;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "";
  const base = (process.env.QUBO_API_URL ?? "http://localhost:3333").replace(/\/$/, "");
  const body = req.method === "POST" ? await req.text() : undefined;

  for (const target of siteTargets(siteHost)) {
    const headers = new Headers({ ...signClientIp(ip), "x-forwarded-proto": "https" });
    if ("siteSlug" in target) headers.set("x-qubo-site", target.siteSlug);
    else headers.set("x-forwarded-host", target.host);
    for (const name of ["cookie", "content-type", "accept-language", "user-agent"]) {
      const v = req.headers.get(name);
      if (v) headers.set(name, v);
    }
    if (token) headers.set(CHAT_TOKEN_HEADER, token);
    if (preview) headers.set(PREVIEW_HEADER, preview);

    const upstream = await fetch(`${base}/${API_VERSION}/chat${path}`, { method: req.method, headers, body, cache: "no-store", signal: req.signal }).catch(
      () => null,
    );
    if (!upstream) return Response.json({ error: "unavailable" }, { status: 502 });
    if (upstream.status === 400) continue; // site_not_resolved: next target

    const out = new Headers({ "cache-control": "no-store, no-transform" });
    for (const name of ["content-type", "x-accel-buffering"]) {
      const v = upstream.headers.get(name);
      if (v) out.set(name, v);
    }
    if (token && !existing && upstream.ok) {
      out.append("set-cookie", `${CHAT_COOKIE}=${token}; Path=/api/chat; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`);
    }
    return new Response(upstream.body, { status: upstream.status, headers: out });
  }
  return Response.json({ error: "site_not_found" }, { status: 404 });
}
