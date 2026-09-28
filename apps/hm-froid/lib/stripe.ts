import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const STRIPE_API = "https://api.stripe.com/v1";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export async function stripeRequest<T>(
  path: string,
  options: { method?: "GET" | "POST"; body?: URLSearchParams } = {},
) {
  const response = await fetch(`${STRIPE_API}${path}`, {
    method: options.method || "GET",
    headers: {
      authorization: `Bearer ${requireEnv("STRIPE_SECRET_KEY")}`,
      ...(options.body
        ? { "content-type": "application/x-www-form-urlencoded" }
        : {}),
    },
    body: options.body,
    cache: "no-store",
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      payload.error &&
      typeof payload.error === "object" &&
      "message" in payload.error
        ? String(payload.error.message)
        : "Stripe request failed";
    throw new Error(message);
  }
  return payload as T;
}

export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
) {
  if (!signatureHeader) return false;
  const parts = signatureHeader.split(",");
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));
  if (!timestamp || !signatures.length || !/^\d+$/.test(timestamp)) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) return false;

  const expected = createHmac(
    "sha256",
    requireEnv("STRIPE_WEBHOOK_SECRET"),
  )
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");

  return signatures.some((signature) => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
    return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  });
}

export function storefrontOrigin(request: Request) {
  const configured = process.env.STOREFRONT_URL?.trim();
  if (configured) return new URL(configured).origin;
  if (process.env.NODE_ENV === "production") {
    throw new Error("STOREFRONT_URL is required in production");
  }
  return new URL(request.url).origin;
}
