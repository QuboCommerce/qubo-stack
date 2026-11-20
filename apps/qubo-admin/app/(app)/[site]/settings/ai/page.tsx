import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
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

export default async function AiSettings({ params }: { params: Promise<{ site: string }> }) {
  const t = await getTranslations("settings.ai");
  const format = await getFormatter();
  const { site: slug } = await params;
  const { site } = await requireSite(slug);
  const readOnly = !canManage(site.memberRole);
  const entitled = await aiEntitled(site.organizationId);

  if (!entitled) {
    return (
      <SettingsPage site={site.slug} title={t("title")} description={t("description")}>
        <Surface className="flex flex-col items-start gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Sparkles className="size-4" />
          </span>
          <div>
            <p className="text-sm font-medium">{t("upsell.title")}</p>
            <p className="mt-1 max-w-prose text-[13px] text-muted-foreground">
              {t("upsell.description")}
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={`/${site.slug}/settings/portal`}>{t("upsell.cta")}</Link>
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
    <SettingsPage site={site.slug} title={t("title")} description={t("description")}>
      {readOnly && <ReadOnlyNote />}
      <div className="space-y-6 @min-[72rem]:space-y-10">
        <SettingsGroup
          title={t("provider")}
          description={t("providerHelp")}
        >
          <AiSettingsForm
            site={site.slug}
            readOnly={readOnly}
            saved={saved && { provider: saved.provider, model: saved.model, baseUrl: saved.baseUrl, apiKeyHint: saved.apiKeyHint, triage: saved.triage, drafts: saved.drafts, monthlyTokens: saved.monthlyTokens }}
          />
        </SettingsGroup>
        {saved && (
          <SettingsGroup title={t("month")} description={t("monthHelp")}>
            <Surface className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span>
                  <span className="font-semibold tabular-nums">{format.number(usage.tokens)}</span> {t("tokens")}
                  {budget !== null && <span className="text-muted-foreground"> {t("ofBudget", { budget: format.number(budget) })}</span>}
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {t("calls", { count: usage.calls })}
                  {usage.failed ? `, ${t("failed", { count: usage.failed })}` : ""} · {providerById(saved.provider)?.label ?? saved.provider}, {saved.model}
                </span>
              </div>
              {pct !== null && (
                <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t("budgetUsed")}>
                  <div className={pct >= 90 ? "h-full bg-destructive" : "h-full bg-foreground"} style={{ width: `${pct}%` }} />
                </div>
              )}
            </Surface>
          </SettingsGroup>
        )}
        <SettingsGroup title={t("rules", { name: site.name })} description={t("rulesHelp")}>
          <AiInstructionsForm site={site.slug} value={settings?.aiInstructions ?? ""} readOnly={readOnly} />
        </SettingsGroup>
      </div>
    </SettingsPage>
  );
}
