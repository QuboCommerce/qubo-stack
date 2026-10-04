import { db } from "@qubo/db/client";
import { aiSettings, aiUsage } from "@qubo/db/schema";
import { access } from "@qubo/portal-client";
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { and, eq, gte, sql } from "drizzle-orm";
import { AI_LIMITS, monthStart, PROVIDERS, providerById, type AiFeature, type ChatTurn, type ProviderKind } from "./index";

export * from "./index";

// ------------------------------------------------------------ key at rest ---

/**
 * AES-256-GCM with a key derived from the instance secret. Rotating
 * QUBO_PREVIEW_SECRET (or BETTER_AUTH_SECRET in dev) means re-entering API keys.
 */
const sealKey = () => {
  const secret = process.env.QUBO_PREVIEW_SECRET?.trim() || process.env.BETTER_AUTH_SECRET?.trim();
  if (!secret) throw new Error("QUBO_PREVIEW_SECRET is required to store AI keys.");
  return createHmac("sha256", secret).update("qubo-ai-keys").digest();
};

export function sealSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", sealKey(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1.${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${body.toString("base64url")}`;
}

/** Null when the secret changed or the value was tampered with. */
export function openSecret(sealed: string): string | null {
  const [v, iv, tag, body] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || body === undefined) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", sealKey(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(body, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// ------------------------------------------------------------ providers ---

export type Endpoint = { kind: ProviderKind; baseUrl: string; apiKey: string | null; model: string };
export type Completion = { text: string; inputTokens: number; outputTokens: number };

export class AiError extends Error {
  constructor(
    message: string,
    readonly code: "not_entitled" | "not_configured" | "disabled" | "budget" | "key" | "provider" | "timeout" | "bad_output",
  ) {
    super(message);
  }
}

const PROVIDER_HOSTS = new Set(PROVIDERS.flatMap((p) => (p.baseUrl ? [new URL(p.baseUrl).origin] : [])));
const trimSlash = (u: string) => u.replace(/\/+$/, "");

async function readError(res: Response) {
  const text = await res.text().catch(() => "");
  try {
    const j = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
    const m = typeof j.error === "string" ? j.error : (j.error?.message ?? j.message);
    if (m) return m.slice(0, 300);
  } catch {}
  return text.slice(0, 300) || res.statusText;
}

const PRIVATE = [/^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^169\.254\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^::1$/, /^f[cd]/i, /^fe80/i, /^::ffff:(127|10|192\.168|169\.254)\./i];

/**
 * Custom endpoints are a server-side fetch to a URL an org admin typed. Fine on a
 * self-hosted box (Ollama on localhost is the point); on shared hosting set
 * AI_PRIVATE_URLS=deny so tenants can't reach internal services.
 */
export async function assertAllowedUrl(raw: string) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new AiError("The server address isn't a valid URL.", "not_configured");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new AiError("The server address must start with http:// or https://.", "not_configured");
  if (process.env.AI_PRIVATE_URLS?.trim().toLowerCase() !== "deny") return;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const ips = isIP(host) ? [host] : await lookup(host, { all: true }).then((r) => r.map((a) => a.address)).catch(() => []);
  if (!ips.length || host === "localhost" || ips.some((ip) => PRIVATE.some((re) => re.test(ip))))
    throw new AiError("This instance only allows AI servers on the public internet.", "not_configured");
}

/** One chat completion. No SDKs: both wire formats are a single POST. */
export async function complete(
  ep: Endpoint,
  turns: ChatTurn[],
  opts: { maxTokens?: number; temperature?: number; json?: boolean; signal?: AbortSignal } = {},
): Promise<Completion> {
  const signal = opts.signal ?? AbortSignal.timeout(AI_LIMITS.requestTimeoutMs);
  const maxTokens = opts.maxTokens ?? 800;
  if (!PROVIDER_HOSTS.has(new URL(ep.baseUrl).origin)) await assertAllowedUrl(ep.baseUrl);
  let res: Response;
  try {
    if (ep.kind === "anthropic") {
      res = await fetch(`${trimSlash(ep.baseUrl)}/messages`, {
        method: "POST",
        signal,
        headers: { "content-type": "application/json", "x-api-key": ep.apiKey ?? "", "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: ep.model,
          max_tokens: maxTokens,
          temperature: opts.temperature ?? 0.3,
          system: turns.filter((t) => t.role === "system").map((t) => t.content).join("\n\n") || undefined,
          messages: turns.filter((t) => t.role !== "system").map((t) => ({ role: t.role, content: t.content })),
        }),
      });
    } else {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (ep.apiKey) headers.authorization = `Bearer ${ep.apiKey}`;
      res = await fetch(`${trimSlash(ep.baseUrl)}/chat/completions`, {
        method: "POST",
        signal,
        headers,
        body: JSON.stringify({
          model: ep.model,
          max_tokens: maxTokens,
          temperature: opts.temperature ?? 0.3,
          messages: turns,
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
    }
  } catch (e) {
    const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    throw new AiError(timeout ? "The AI provider took too long to answer." : `Could not reach the AI provider: ${e instanceof Error ? e.message : String(e)}`, timeout ? "timeout" : "provider");
  }
  if (!res.ok) {
    const msg = await readError(res);
    throw new AiError(`${res.status === 401 || res.status === 403 ? "The API key was refused" : `The AI provider answered ${res.status}`}: ${msg}`, res.status === 401 || res.status === 403 ? "key" : "provider");
  }
  const j = (await res.json().catch(() => null)) as Record<string, any> | null;
  if (!j) throw new AiError("The AI provider sent an unreadable answer.", "bad_output");
  if (ep.kind === "anthropic") {
    const text = Array.isArray(j.content) ? j.content.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("") : "";
    return { text, inputTokens: Number(j.usage?.input_tokens) || 0, outputTokens: Number(j.usage?.output_tokens) || 0 };
  }
  const text = j.choices?.[0]?.message?.content;
  return { text: typeof text === "string" ? text : "", inputTokens: Number(j.usage?.prompt_tokens) || 0, outputTokens: Number(j.usage?.completion_tokens) || 0 };
}

// ------------------------------------------------------- per-org config ---

export type AiSettingsRow = typeof aiSettings.$inferSelect;

/** Plan includes AI and the org is inside the licence. */
export async function aiEntitled(orgId: string) {
  const a = await access();
  return a.entitlements.features.includes("ai") && !a.lockedOrgIds.has(orgId);
}

export async function getAiSettings(orgId: string): Promise<AiSettingsRow | null> {
  const [row] = await db.select().from(aiSettings).where(eq(aiSettings.organizationId, orgId)).limit(1);
  return row ?? null;
}

export function endpointFor(row: Pick<AiSettingsRow, "provider" | "model" | "baseUrl" | "apiKeyEnc">): Endpoint {
  const p = providerById(row.provider);
  if (!p) throw new AiError(`Unknown AI provider "${row.provider}".`, "not_configured");
  const baseUrl = p.baseUrl ?? row.baseUrl;
  if (!baseUrl) throw new AiError("This provider needs a server address.", "not_configured");
  const apiKey = row.apiKeyEnc ? openSecret(row.apiKeyEnc) : null;
  if (row.apiKeyEnc && apiKey === null) throw new AiError("The saved API key can't be read anymore (the instance secret changed). Enter it again.", "key");
  if (p.keyRequired && !apiKey) throw new AiError("No API key saved.", "not_configured");
  return { kind: p.kind, baseUrl, apiKey, model: row.model };
}

export async function usageThisMonth(orgId: string, now = new Date()) {
  const [r] = await db
    .select({
      tokens: sql<number>`coalesce(sum(${aiUsage.inputTokens} + ${aiUsage.outputTokens}), 0)::int`,
      calls: sql<number>`count(*)::int`,
      failed: sql<number>`count(*) filter (where not ${aiUsage.ok})::int`,
    })
    .from(aiUsage)
    .where(and(eq(aiUsage.organizationId, orgId), gte(aiUsage.createdAt, monthStart(now))));
  return { tokens: r?.tokens ?? 0, calls: r?.calls ?? 0, failed: r?.failed ?? 0 };
}

export type AiReady = { settings: AiSettingsRow; endpoint: Endpoint };

/** Everything that must hold before a model call; throws AiError with a reason the UI can show. */
/** `manual`: a person asked for this one call, so the automatic-feature toggles don't apply. */
export async function requireAi(orgId: string, feature: AiFeature, opts: { manual?: boolean } = {}): Promise<AiReady> {
  if (!(await aiEntitled(orgId))) throw new AiError("AI is part of the Starter plan and up.", "not_entitled");
  const settings = await getAiSettings(orgId);
  if (!settings) throw new AiError("AI isn't set up for this organisation yet.", "not_configured");
  if (feature === "triage" && !settings.triage && !opts.manual) throw new AiError("Triage is turned off.", "disabled");
  if (feature === "draft" && !settings.drafts) throw new AiError("Drafts are turned off.", "disabled");
  if (settings.monthlyTokens != null && feature !== "test") {
    const used = await usageThisMonth(orgId);
    if (used.tokens >= settings.monthlyTokens) throw new AiError("This month's AI token budget is used up.", "budget");
  }
  return { settings, endpoint: endpointFor(settings) };
}

/** complete() plus a usage row, success or not. */
export async function run(
  ready: AiReady,
  ctx: { orgId: string; siteId?: string | null; feature: AiFeature },
  turns: ChatTurn[],
  opts?: Parameters<typeof complete>[2],
): Promise<Completion> {
  const base = { organizationId: ctx.orgId, siteId: ctx.siteId ?? null, feature: ctx.feature, provider: ready.settings.provider, model: ready.endpoint.model };
  try {
    const out = await complete(ready.endpoint, turns, opts);
    await db.insert(aiUsage).values({ ...base, inputTokens: out.inputTokens, outputTokens: out.outputTokens, ok: true });
    return out;
  } catch (e) {
    await db.insert(aiUsage).values({ ...base, ok: false, error: e instanceof Error ? e.message.slice(0, 300) : "failed" }).catch(() => {});
    throw e;
  }
}
