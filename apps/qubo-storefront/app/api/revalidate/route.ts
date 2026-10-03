import { createHmac, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { LAYOUTS_TAG, siteTag } from "@/lib/site";

/**
 * Publish hook from @qubo/studio `notifyRevalidate`: `POST { site, tags }`
 * signed with `x-qubo-signature` = HMAC-SHA256(body, QUBO_REVALIDATE_SECRET).
 * Drops the whole site (pages are cached by site, not by document).
 */
export async function POST(req: Request) {
  const secret = process.env.QUBO_REVALIDATE_SECRET;
  if (!secret) return Response.json({ error: "not_configured" }, { status: 503 });

  const body = await req.text();
  const given = Buffer.from(req.headers.get("x-qubo-signature") ?? "", "hex");
  const expected = createHmac("sha256", secret).update(body).digest();
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ error: "bad_signature" }, { status: 401 });
  }

  let input: { site?: unknown; tags?: unknown };
  try {
    input = JSON.parse(body);
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }
  const tags = new Set<string>([LAYOUTS_TAG]);
  if (typeof input.site === "string" && input.site) tags.add(siteTag(input.site));
  if (Array.isArray(input.tags)) for (const t of input.tags) if (typeof t === "string") tags.add(t);

  for (const tag of tags) revalidateTag(tag, { expire: 0 });
  return Response.json({ revalidated: [...tags] });
}
