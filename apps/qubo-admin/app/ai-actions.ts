"use server";

import { db } from "@qubo/db/client";
import { aiSettings, siteSettings } from "@qubo/db/schema";
import { AiError, aiEntitled, assertAllowedUrl, endpointFor, getAiSettings, keyHint, providerById, run, sealSecret } from "@qubo/ai/server";
import { draftReply, triageConversation } from "@qubo/inbox/ai";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSiteFromForm } from "@/lib/admin";
import type { ActionState } from "@/lib/action-state";

async function requireOrgManager(formData: FormData) {
  const ctx = await requireSiteFromForm(formData);
  if (ctx.site.memberRole !== "OWNER" && ctx.site.memberRole !== "ADMIN") throw new Error("Only owners and admins can change AI settings.");
  return ctx;
}

const message = (e: unknown) => (e instanceof AiError || e instanceof Error ? e.message : "Something went wrong.");

const settingsSchema = z.object({
  provider: z.string().refine((p) => providerById(p), "Pick a provider."),
  model: z.string().trim().min(1, "Enter a model.").max(120),
  baseUrl: z.string().trim().max(300).optional().default(""),
  apiKey: z.string().trim().max(500).optional().default(""),
  clearKey: z.enum(["on"]).optional(),
  triage: z.enum(["on"]).optional(),
  drafts: z.enum(["on"]).optional(),
  monthlyTokens: z
    .string()
    .trim()
    .regex(/^\d*$/, "Budget must be a whole number of tokens.")
    .optional()
    .default(""),
});

export async function saveAiSettingsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { site, user } = await requireOrgManager(formData);
    if (!(await aiEntitled(site.organizationId))) return { error: "AI is part of the Starter plan and up." };
    const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };
    const d = parsed.data;
    const provider = providerById(d.provider)!;
    const baseUrl = provider.baseUrl ? null : d.baseUrl.replace(/\/+$/, "");
    if (!provider.baseUrl) {
      if (!baseUrl) return { error: "Enter the server address, e.g. http://localhost:11434/v1." };
      await assertAllowedUrl(baseUrl);
    }
    const existing = await getAiSettings(site.organizationId);
    // Switching provider drops the old key: it belongs to someone else's API.
    const keepKey = existing && existing.provider === d.provider && !d.clearKey;
    const key = d.apiKey ? { apiKeyEnc: sealSecret(d.apiKey), apiKeyHint: keyHint(d.apiKey) } : keepKey ? {} : { apiKeyEnc: null, apiKeyHint: null };
    if (provider.keyRequired && !d.apiKey && !(keepKey && existing?.apiKeyEnc)) return { error: `Paste your ${provider.label} API key.` };
    const values = {
      provider: d.provider,
      model: d.model,
      baseUrl,
      triage: d.triage === "on",
      drafts: d.drafts === "on",
      monthlyTokens: d.monthlyTokens ? Math.min(Number(d.monthlyTokens), 2_000_000_000) : null,
      updatedById: user.id,
      updatedAt: new Date(),
      ...key,
    };
    await db
      .insert(aiSettings)
      .values({ organizationId: site.organizationId, ...values })
      .onConflictDoUpdate({ target: aiSettings.organizationId, set: values });
    revalidatePath(`/${site.slug}/settings/ai`);
    return { ok: true, at: Date.now() };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function removeAiSettingsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { site } = await requireOrgManager(formData);
    await db.delete(aiSettings).where(eq(aiSettings.organizationId, site.organizationId));
    revalidatePath(`/${site.slug}/settings/ai`);
    return { ok: true, at: Date.now() };
  } catch (e) {
    return { error: message(e) };
  }
}

/** Round trip with the saved settings; counts as usage but ignores the budget. */
export async function testAiAction(_: ActionState, formData: FormData): Promise<ActionState & { reply?: string }> {
  try {
    const { site } = await requireOrgManager(formData);
    if (!(await aiEntitled(site.organizationId))) return { error: "AI is part of the Starter plan and up." };
    const settings = await getAiSettings(site.organizationId);
    if (!settings) return { error: "Save your settings first." };
    const ready = { settings, endpoint: endpointFor(settings) };
    const out = await run(ready, { orgId: site.organizationId, siteId: site.id, feature: "test" }, [{ role: "user", content: "Reply with the single word: ready" }], { maxTokens: 10, temperature: 0 });
    revalidatePath(`/${site.slug}/settings/ai`);
    return { ok: true, at: Date.now(), reply: out.text.trim().slice(0, 80) || "(empty answer)" };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function saveAiInstructionsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { site } = await requireOrgManager(formData);
    const text = z.string().trim().max(4000, "Keep instructions under 4,000 characters.").safeParse(formData.get("instructions") ?? "");
    if (!text.success) return { error: text.error.issues[0]?.message };
    const value = text.data || null;
    await db
      .insert(siteSettings)
      .values({ siteId: site.id, aiInstructions: value })
      .onConflictDoUpdate({ target: siteSettings.siteId, set: { aiInstructions: value, updatedAt: new Date() } });
    revalidatePath(`/${site.slug}/settings/ai`);
    return { ok: true, at: Date.now() };
  } catch (e) {
    return { error: message(e) };
  }
}

// ---------------------------------------------------------------- inbox ---

const convo = z.object({ id: z.uuid(), hint: z.string().trim().max(500).optional() });

export async function draftReplyAction(_: unknown, formData: FormData): Promise<{ text?: string; error?: string; at: number }> {
  try {
    const { site, user } = await requireSiteFromForm(formData);
    const p = convo.safeParse(Object.fromEntries(formData));
    if (!p.success) return { error: "Invalid conversation.", at: Date.now() };
    const out = await draftReply({ siteId: site.id, conversationId: p.data.id, staffId: user.id, hint: p.data.hint });
    return { text: out.text, at: Date.now() };
  } catch (e) {
    return { error: message(e), at: Date.now() };
  }
}

export async function retriageAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { site } = await requireSiteFromForm(formData);
    const p = convo.safeParse(Object.fromEntries(formData));
    if (!p.success) return { error: "Invalid conversation." };
    const ai = await triageConversation(site.id, p.data.id, { force: true });
    if (!ai) return { error: "There's no customer message to read yet." };
    revalidatePath(`/${site.slug}/inbox`);
    return { ok: true, at: Date.now() };
  } catch (e) {
    return { error: message(e) };
  }
}
