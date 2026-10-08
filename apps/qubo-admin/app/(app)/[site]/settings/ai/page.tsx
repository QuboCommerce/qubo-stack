import Link from "next/link";
import { db } from "@qubo/db/client";
import { siteSettings } from "@qubo/db/schema";
import { aiEntitled, getAiSettings, providerById, usageThisMonth } from "@qubo/ai/server";
import { eq } from "drizzle-orm";
import { Sparkles } from "lucide-react";
import { AiInstructionsForm, AiSettingsForm } from "@/components/settings/ai-settings-form";
import { ReadOnlyNote, canManage } from "@/components/settings/read-only-note";
import { SettingsGroup, Surface } from "@/components/settings/settings-group";
import { SettingsPage } from "@/components/settings/settings-page";
import { Button } from "@/components/ui/button";
import { requireSite } from "@/lib/admin";

const fmt = new Intl.NumberFormat("en-GB");

export default async function AiSettings({ params }: { params: Promise<{ site: string }> }) {
  const { site: slug } = await params;
  const { site } = await requireSite(slug);
  const readOnly = !canManage(site.memberRole);
  const entitled = await aiEntitled(site.organizationId);

  if (!entitled) {
    return (
      <SettingsPage site={site.slug} title="AI" description="Triage and reply drafts for the inbox, on your own AI provider account.">
        <Surface className="flex flex-col items-start gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Sparkles className="size-4" />
          </span>
          <div>
            <p className="text-sm font-medium">AI is included from the Starter plan</p>
            <p className="mt-1 max-w-prose text-[13px] text-muted-foreground">
              Bring a key from OpenAI, Anthropic, Mistral, xAI or OpenRouter, or point Qubo at your own model server. Qubo never sees your conversations or bills for tokens; your provider does.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={`/${site.slug}/settings/portal`}>See your plan</Link>
          </Button>
        </Surface>
      </SettingsPage>
    );
  }

  const [saved, usage, [settings]] = await Promise.all([
    getAiSettings(site.organizationId),
    usageThisMonth(site.organizationId),
    db.select({ aiInstructions: siteSettings.aiInstructions }).from(siteSettings).where(eq(siteSettings.siteId, site.id)).limit(1),
  ]);
  const budget = saved?.monthlyTokens ?? null;
  const pct = budget ? Math.min(100, Math.round((usage.tokens / budget) * 100)) : null;

  return (
    <SettingsPage site={site.slug} title="AI" description="Triage and reply drafts for the inbox, on your own AI provider account.">
      {readOnly && <ReadOnlyNote />}
      <div className="space-y-6 @min-[72rem]:space-y-10">
        <SettingsGroup
          title="Provider"
          description="Shared by every site in this organisation. Messages are sent from this server straight to the provider you pick; nothing goes through Qubo."
        >
          <AiSettingsForm
            site={site.slug}
            readOnly={readOnly}
            saved={saved && { provider: saved.provider, model: saved.model, baseUrl: saved.baseUrl, apiKeyHint: saved.apiKeyHint, triage: saved.triage, drafts: saved.drafts, monthlyTokens: saved.monthlyTokens }}
          />
        </SettingsGroup>
        {saved && (
          <SettingsGroup title="This month" description="Counted from the token figures your provider reports. Resets on the 1st (UTC).">
            <Surface className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span>
                  <span className="font-semibold tabular-nums">{fmt.format(usage.tokens)}</span> tokens
                  {budget !== null && <span className="text-muted-foreground"> of {fmt.format(budget)}</span>}
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {usage.calls} call{usage.calls === 1 ? "" : "s"}
                  {usage.failed ? `, ${usage.failed} failed` : ""} · {providerById(saved.provider)?.label ?? saved.provider}, {saved.model}
                </span>
              </div>
              {pct !== null && (
                <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Budget used">
                  <div className={pct >= 90 ? "h-full bg-destructive" : "h-full bg-foreground"} style={{ width: `${pct}%` }} />
                </div>
              )}
            </Surface>
          </SettingsGroup>
        )}
        <SettingsGroup title={`House rules for ${site.name}`} description="Drafts follow these on top of the conversation, the customer's orders and matching products. Tone, opening hours, delivery and return policies.">
          <AiInstructionsForm site={site.slug} value={settings?.aiInstructions ?? ""} readOnly={readOnly} />
        </SettingsGroup>
      </div>
    </SettingsPage>
  );
}
