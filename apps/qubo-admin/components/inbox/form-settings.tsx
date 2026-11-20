"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { updateFormAction } from "@/app/inbox-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** One form: its name in the inbox and who is e-mailed on every submission. */
export function FormSettingsRow({
  site,
  form,
  readOnly,
}: {
  site: string;
  form: { id: string; key: string; name: string; notifyEmails: string[]; submissions: number };
  readOnly: boolean;
}) {
  const t = useTranslations("inbox.formSettings");
  const [state, action, pending] = useActionState(updateFormAction, null);
  return (
    <form action={action} className="grid gap-3 px-4 py-4 sm:px-5">
      <input type="hidden" name="site" value={site} />
      <input type="hidden" name="formId" value={form.id} />
      <div className="flex flex-wrap items-baseline gap-x-2 text-[13px] text-muted-foreground">
        <span className="font-mono">/api/forms/{form.key}</span>
        <span>· {t("submissions", { count: form.submissions })}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <div className="grid gap-1.5">
          <Label htmlFor={`name-${form.id}`}>{t("name")}</Label>
          <Input id={`name-${form.id}`} name="name" defaultValue={form.name} disabled={readOnly} maxLength={80} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`notify-${form.id}`}>{t("notify")}</Label>
          <Input
            id={`notify-${form.id}`}
            name="notifyEmails"
            defaultValue={form.notifyEmails.join(", ")}
            disabled={readOnly}
            placeholder={t("notifyPlaceholder")}
            autoComplete="off"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        {!readOnly && (
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            {pending ? t("saving") : t("save")}
          </Button>
        )}
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        {state?.ok && !pending && (
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <Check className="size-4" /> {t("saved")}
          </p>
        )}
      </div>
    </form>
  );
}
