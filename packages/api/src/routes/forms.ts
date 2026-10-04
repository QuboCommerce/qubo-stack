import { Elysia, t } from "elysia";
import { createRateLimiter, HONEYPOT, LIMITS } from "@qubo/inbox";
import { submitForm } from "@qubo/inbox/server";
import { verifiedClientIp } from "@qubo/shared/client-ip";
import { tenancy } from "../plugins/tenancy";

const perVisitor = createRateLimiter();
/** Backstop for whatever slips past the per-visitor limit (rotating IPs, direct API calls). */
const perSite = createRateLimiter(LIMITS.submissionsPerSiteWindow);

/** Visitor IP: signed by the storefront, else the proxy's view of the caller. */
const clientIp = (headers: Record<string, string | undefined>) =>
  verifiedClientIp((n) => headers[n]) || headers["x-forwarded-for"]?.split(",")[0]?.trim() || headers["x-real-ip"] || "unknown";

/**
 * Public form endpoint. The storefront's `/api/forms/:key` proxies here with
 * the visitor's host, so the form lands on the right site. Spam (honeypot) is
 * stored as such and answered like a success so bots learn nothing.
 */
export const forms = new Elysia({ prefix: "/forms" }).use(tenancy).post(
  "/:key",
  async ({ site, params, body, headers, status }) => {
    if (!site) return status(400, { error: "site_not_resolved" });
    if (!perVisitor(`${site.id}:${clientIp(headers)}`) || !perSite(site.id)) return status(429, { error: "rate_limited" });
    const spam = Boolean(body.data[HONEYPOT]?.toString().trim());
    const result = await submitForm({ siteId: site.id, key: params.key, raw: body.data, spam, pagePath: body.pagePath, locale: body.locale });
    if (!result.ok) return status(result.error === "empty" ? 422 : 409, { error: result.error });
    return { ok: true };
  },
  {
    body: t.Object({
      data: t.Record(t.String(), t.Any()),
      pagePath: t.Optional(t.String({ maxLength: 512 })),
      locale: t.Optional(t.String({ maxLength: 16 })),
    }),
  },
);
