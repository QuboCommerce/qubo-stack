import { NextResponse, type NextRequest } from "next/server";
import { createStorefrontClient, QuboApiError } from "@qubo/storefront";
import { signClientIp } from "@qubo/shared/client-ip";
import { previewSiteHost, requestHost, siteTargets } from "@/lib/hosts";
import { PREVIEW_COOKIE, PREVIEW_HEADER } from "@/lib/preview";

export const dynamic = "force-dynamic";

const MAX_TEXT_BODY = 64 * 1024;
/** Multipart may carry files we don't store yet; they're read, named and dropped. */
const MAX_MULTIPART_BODY = 12 * 1024 * 1024;

/**
 * Target of every form block (`/api/forms/:key`). With `Accept: application/json`
 * (the enhancer) it answers JSON; plain HTML posts get a 303 back to the page
 * with `?form=<key>&form_status=sent|error`.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const host = requestHost(req.headers);
  const previewOf = previewSiteHost(host);
  const siteHost = previewOf ?? host;
  const wantsJson = req.headers.get("accept")?.includes("application/json") ?? false;

  const referer = safeReferer(req.headers.get("referer"), host);
  const respond = (status: number, error?: string) => {
    if (wantsJson) return NextResponse.json(error ? { ok: false, error } : { ok: true }, { status });
    const back = new URL(referer ?? "/", `https://${host}`);
    back.searchParams.set("form", key);
    back.searchParams.set("form_status", error ? "error" : "sent");
    return NextResponse.redirect(back, 303);
  };

  const max = req.headers.get("content-type")?.includes("multipart/") ? MAX_MULTIPART_BODY : MAX_TEXT_BODY;
  if (Number(req.headers.get("content-length") ?? 0) > max) return respond(413, "too_large");
  const data = await readFields(req).catch(() => null);
  if (!data) return respond(400, "invalid_body");

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "";
  const token = previewOf ? req.cookies.get(PREVIEW_COOKIE)?.value : undefined;
  const body = { data, pagePath: referer ?? undefined, locale: req.headers.get("accept-language")?.split(",")[0]?.slice(0, 16) };

  for (const target of siteTargets(siteHost)) {
    const client = createStorefrontClient({
      ...target,
      host: siteHost,
      fetch: (i, init) => fetch(i, { ...init, cache: "no-store" }),
      headers: token ? { [PREVIEW_HEADER]: token } : undefined,
    });
    try {
      await client.submitForm(key, body, signClientIp(ip));
      return respond(200);
    } catch (error) {
      if (error instanceof QuboApiError && error.status === 400) continue; // site_not_resolved: next target
      if (error instanceof QuboApiError) return respond(error.status, error.code);
      console.error("[forms] submit failed", error);
      return respond(502, "unavailable");
    }
  }
  return respond(404, "site_not_found");
}

/** Same-host path of the page the form was on (never an open redirect). */
function safeReferer(referer: string | null, host: string): string | null {
  if (!referer) return null;
  try {
    const u = new URL(referer);
    return u.host === host ? `${u.pathname}${u.search.replace(/([?&])form(_status)?=[^&]*/g, "$1").replace(/[?&]+$/, "")}` : null;
  } catch {
    return null;
  }
}

/** JSON `{...}` or form-encoded / multipart text fields. Files aren't stored yet; their names are kept. */
async function readFields(req: NextRequest): Promise<Record<string, string>> {
  const type = req.headers.get("content-type") ?? "";
  const out: Record<string, string> = {};
  if (type.includes("application/json")) {
    const json = (await req.json()) as Record<string, unknown>;
    for (const [k, v] of Object.entries(json)) if (typeof v === "string") out[k] = v;
    return out;
  }
  const form = await req.formData();
  for (const [k, v] of form.entries()) {
    if (typeof v === "string") out[k] = out[k] ? `${out[k]}, ${v}` : v;
    else if ((v as File).size > 0) out[k] = `${(v as File).name} (attachment not uploaded)`;
  }
  return out;
}
