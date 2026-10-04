import { receiveEmail, type InboundEmail } from "@qubo/inbox/server";
import { Elysia } from "elysia";
import { verifySvix } from "../lib/svix";

type Received = {
  id: string;
  from: string;
  to?: string[] | null;
  cc?: string[] | null;
  received_for?: string[] | null;
  subject?: string | null;
  text?: string | null;
  html?: string | null;
  message_id?: string | null;
  headers?: Record<string, string | string[]> | null;
  authentication?: { dmarc?: string } | null;
  attachments?: { filename?: string; size?: number }[] | null;
};

async function fetchReceived(id: string): Promise<Received> {
  const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(id)}?html_format=cid`, {
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY?.trim()}` },
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as Received;
}

const toInbound = (r: Received): InboundEmail => ({
  id: r.id,
  messageId: r.message_id ?? null,
  from: r.headers?.from && typeof r.headers.from === "string" ? r.headers.from : r.from,
  to: r.to ?? [],
  cc: r.cc ?? [],
  receivedFor: r.received_for ?? [],
  subject: r.subject ?? "",
  text: r.text ?? null,
  html: r.html ?? null,
  headers: r.headers ?? {},
  dmarc: r.authentication?.dmarc ?? null,
  attachments: (r.attachments ?? []).map((a) => ({ filename: a.filename || "file", size: a.size })),
});

/** Resend `email.received` → inbox. Unversioned like the Stripe webhook: the URL lives in Resend's dashboard. */
export const inbound = new Elysia().post(
  "/webhooks/resend",
  async ({ request, status }) => {
    const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
    if (!secret || !process.env.RESEND_API_KEY?.trim()) return status(503, { error: "inbound_not_configured" });
    const raw = await request.text();
    if (!verifySvix(secret, request.headers, raw)) return status(400, { error: "invalid_signature" });
    const event = JSON.parse(raw) as { type?: string; data?: { email_id?: string } };
    if (event.type !== "email.received" || !event.data?.email_id) return { received: true };
    try {
      const result = await receiveEmail(toInbound(await fetchReceived(event.data.email_id)));
      if (!result.ok) console.info("[inbound] skipped", event.data.email_id, result.reason);
      return { received: true, ...result };
    } catch (error) {
      // 5xx makes Resend retry; duplicates are dropped by Message-ID.
      console.error("[inbound]", error);
      return status(500, { error: "inbound_failed" });
    }
  },
  { parse: "none", detail: { summary: "Resend webhook: received e-mail into the inbox" } },
);
