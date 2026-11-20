"use client";

import { useActionState, useState } from "react";
import { Check, ExternalLink, PlugZap } from "lucide-react";
import { useTranslations } from "next-intl";
import { PROVIDERS, providerById } from "@qubo/ai";
import { removeAiSettingsAction, saveAiInstructionsAction, saveAiSettingsAction, testAiAction } from "@/app/ai-actions";
import { Field, Select, SwitchRow, TextArea, TextInput } from "@/components/settings/controls";
import { Surface } from "@/components/settings/settings-group";
import { Button } from "@/components/ui/button";

type Saved = { provider: string; model: string; baseUrl: string | null; apiKeyHint: string | null; triage: boolean; drafts: boolean; monthlyTokens: number | null } | null;

function Status({ state, pending }: { state: { ok?: boolean; error?: string } | null; pending: boolean }) {
  const t = useTranslations("common");
  if (pending) return null;
  if (state?.error) return <p className="text-sm text-destructive">{state.error}</p>;
  if (state?.ok)
    return (
      <p className="flex items-center gap-1 text-sm text-muted-foreground">
        <Check className="size-4" /> {t("saved")}
      </p>
    );
  return null;
}

export function AiSettingsForm({ site, saved, readOnly }: { site: string; saved: Saved; readOnly: boolean }) {
  const t = useTranslations("settings.ai");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(saveAiSettingsAction, null);
  const [testState, test, testing] = useActionState(testAiAction, null);
  const [, remove, removing] = useActionState(removeAiSettingsAction, null);
  const [providerId, setProviderId] = useState(saved?.provider ?? "openai");
  const provider = providerById(providerId) ?? PROVIDERS[0];
  const sameProvider = saved?.provider === providerId;

  return (
    <div className="space-y-3">
      <Surface flush>
        <form action={action}>
          <input type="hidden" name="site" value={site} />
          <fieldset disabled={readOnly} className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <Field label={t("provider")} htmlFor="ai-provider">
              <Select id="ai-provider" name="provider" value={providerId} onChange={(e) => setProviderId(e.target.value)}>
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("model")} htmlFor="ai-model" hint={provider.models.length ? t("modelExamples", { models: provider.models.join(", ") }) : t("modelCustom")}>
              <TextInput id="ai-model" name="model" key={providerId} defaultValue={sameProvider ? saved?.model : provider.models[0]} list="ai-models" required maxLength={120} autoComplete="off" />
              <datalist id="ai-models">
                {provider.models.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Field>
            {!provider.baseUrl && (
              <Field label={t("serverAddress")} htmlFor="ai-base" className="sm:col-span-2" hint={t("serverAddressHint")}>
                <TextInput id="ai-base" name="baseUrl" defaultValue={saved?.baseUrl ?? ""} placeholder="http://localhost:11434/v1" required inputMode="url" autoComplete="off" />
              </Field>
            )}
            <Field
              label={t("apiKey")}
              htmlFor="ai-key"
              className="sm:col-span-2"
              hint={
                <>
                  {t("apiKeyHint", { provider: provider.label })}{" "}
                  {provider.keyUrl && (
                    <a href={provider.keyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline underline-offset-2">
                      {t("getKey")} <ExternalLink className="size-3" />
                    </a>
                  )}
                </>
              }
            >
              <TextInput
                id="ai-key"
                name="apiKey"
                type="password"
                key={`key-${providerId}`}
                placeholder={sameProvider && saved?.apiKeyHint ? t("keySaved", { hint: saved.apiKeyHint }) : provider.keyRequired ? t("keyPaste") : t("keyOptional")}
                autoComplete="off"
                spellCheck={false}
              />
              {sameProvider && saved?.apiKeyHint && !provider.keyRequired && (
                <label className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" name="clearKey" /> {t("removeKey")}
                </label>
              )}
            </Field>
            <Field label={t("budget")} htmlFor="ai-budget" hint={t("budgetHint")}>
              <TextInput id="ai-budget" name="monthlyTokens" inputMode="numeric" defaultValue={saved ? (saved.monthlyTokens ?? "") : 2_000_000} placeholder={t("noCap")} />
            </Field>
          </fieldset>
          <fieldset disabled={readOnly} className="divide-y border-t">
            <SwitchRow name="triage" defaultChecked={saved?.triage ?? true} label={t("triage")} description={t("triageHelp")} />
            <SwitchRow name="drafts" defaultChecked={saved?.drafts ?? true} label={t("drafts")} description={t("draftsHelp")} />
          </fieldset>
          {!readOnly && (
            <div className="flex flex-wrap items-center gap-3 border-t px-4 py-3 sm:px-5">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? t("saving") : tCommon("save")}
              </Button>
              <Status state={state} pending={pending} />
            </div>
          )}
        </form>
      </Surface>
      {saved && !readOnly && (
        <div className="flex flex-wrap items-center gap-3 px-3 xs:px-0">
          <form action={test}>
            <input type="hidden" name="site" value={site} />
            <Button type="submit" size="sm" variant="outline" disabled={testing}>
              <PlugZap className="size-4" />
              {testing ? t("testing") : t("test")}
            </Button>
          </form>
          <form
            action={remove}
            onSubmit={(e) => {
              if (!confirm(t("confirmOff"))) e.preventDefault();
            }}
          >
            <input type="hidden" name="site" value={site} />
            <Button type="submit" size="sm" variant="ghost" disabled={removing} className="text-muted-foreground">
              {t("turnOff")}
            </Button>
          </form>
          {!testing && testState?.error && <p className="text-sm text-destructive">{testState.error}</p>}
          {!testing && testState?.ok && (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <Check className="size-4" /> {t("connected", { reply: testState.reply ?? "" })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function AiInstructionsForm({ site, value, readOnly }: { site: string; value: string; readOnly: boolean }) {
  const t = useTranslations("settings.ai");
  const [state, action, pending] = useActionState(saveAiInstructionsAction, null);
  return (
    <Surface flush>
      <form action={action}>
        <input type="hidden" name="site" value={site} />
        <div className="p-4 sm:p-5">
          <TextArea
            name="instructions"
            defaultValue={value}
            disabled={readOnly}
            maxLength={4000}
            rows={7}
            aria-label={t("instructionsLabel")}
            placeholder={t("instructionsPlaceholder")}
          />
        </div>
        {!readOnly && (
          <div className="flex items-center gap-3 border-t px-4 py-3 sm:px-5">
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
              {pending ? t("saving") : t("saveInstructions")}
            </Button>
            <Status state={state} pending={pending} />
          </div>
        )}
      </form>
    </Surface>
  );
}
