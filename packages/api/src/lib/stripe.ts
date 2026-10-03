import { createHmac, timingSafeEqual } from "node:crypto";

const STRIPE_API = "https://api.stripe.com/v1";

export class StripeConfigError extends Error {}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new StripeConfigError(`Missing ${name}`);
  return value;
}

export async function stripeRequest<T>(
  path: string,
  options: { method?: "GET" | "POST"; body?: URLSearchParams } = {},
): Promise<T> {
  const response = await fetch(`${STRIPE_API}${path}`, {
    method: options.method ?? "GET",
    headers: {
      authorization: `Bearer ${requireEnv("STRIPE_SECRET_KEY")}`,
      ...(options.body ? { "content-type": "application/x-www-form-urlencoded" } : {}),
    },
    body: options.body,
  });
  const payload = (await response.json()) as { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? "Stripe request failed");
  return payload as T;
}

/** Verifies a `stripe-signature` header (v1 scheme, 5 minute tolerance). */
export function verifyStripeSignature(rawBody: string, header: string | null) {
  if (!header) return false;
  const parts = header.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const signatures = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!timestamp || !signatures.length || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const expected = createHmac("sha256", requireEnv("STRIPE_WEBHOOK_SECRET"))
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest();
  return signatures.some(
    (s) => /^[a-f0-9]{64}$/i.test(s) && timingSafeEqual(Buffer.from(s, "hex"), expected),
  );
}
