"use client";

import { useActionState, useEffect, useState } from "react";
import { Building2, Globe2, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createOrganizationAction, createSiteAction } from "@/app/provision-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, RadioCard, Select, TextInput } from "@/components/settings/controls";
import { siteTypeIcon } from "@/lib/site-type-icons";
import type { ActionState } from "@/lib/action-state";
import type { ShellOrg } from "@/components/shell/types";

export const SITE_TYPES = ["store", "services", "business", "editorial", "custom"] as const;

export const LOCALE_OPTIONS = [
  { value: "fr-BE", label: "Français (Belgique)" },
  { value: "nl-BE", label: "Nederlands (België)" },
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
  { value: "nl", label: "Nederlands" },
];

type DialogProps = { open: boolean; onOpenChange: (open: boolean) => void };

function useDone(state: ActionState, message: string, close: () => void) {
  useEffect(() => {
    if (state?.ok) {
      toast.success(message);
      close();
    }
  }, [state?.ok, state?.at]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** An organisation is a legal entity. It stays empty until a site is created inside it. */
export function CreateOrganizationDialog({ open, onOpenChange }: DialogProps) {
  const t = useTranslations("shell.create");
  const [state, action, pending] = useActionState(createOrganizationAction, null);
  useDone(state, t("organisation.created"), () => onOpenChange(false));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form action={action} className="grid gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Building2 className="size-4" /> {t("organisation.title")}</DialogTitle>
            <DialogDescription>
              {t("organisation.description")}
            </DialogDescription>
          </DialogHeader>
          <Field label={t("organisation.name")} htmlFor="org-name">
            <TextInput id="org-name" name="name" required minLength={2} autoFocus placeholder={t("organisation.namePlaceholder")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("organisation.legalName")} hint={t("organisation.optional")} htmlFor="org-legal">
              <TextInput id="org-legal" name="legalName" placeholder={t("organisation.legalNamePlaceholder")} />
            </Field>
            <Field label={t("organisation.companyNumber")} hint={t("organisation.optional")} htmlFor="org-number">
              <TextInput id="org-number" name="companyNumber" placeholder={t("organisation.companyNumberPlaceholder")} />
            </Field>
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost">{t("cancel")}</Button></DialogClose>
            <Button type="submit" disabled={pending}>{pending ? t("organisation.creating") : t("organisation.submit")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A site is born complete (pages, header, footer, theme) and lands you in its dashboard. */
export function CreateSiteDialog({ open, onOpenChange, orgs, defaultOrgId }: DialogProps & { orgs: ShellOrg[]; defaultOrgId?: string }) {
  const t = useTranslations("shell.create");
  const [state, action, pending] = useActionState(createSiteAction, null);
  const managed = orgs.filter((o) => !o.locked && (o.role === "OWNER" || o.role === "ADMIN"));
  const [org, setOrg] = useState(defaultOrgId ?? managed[0]?.id ?? "");
  // Controlled so a failed submit keeps what was typed (React resets the form after an action).
  const [name, setName] = useState("");
  const [locale, setLocale] = useState("fr-BE");
  const [type, setType] = useState<string>("store");
  useEffect(() => {
    if (open) setOrg(defaultOrgId && managed.some((o) => o.id === defaultOrgId) ? defaultOrgId : (managed[0]?.id ?? ""));
  }, [open, defaultOrgId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <form action={action} className="grid gap-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Globe2 className="size-4" /> {t("site.title")}</DialogTitle>
            <DialogDescription>
              {t("site.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
            <Field label={t("site.name")} htmlFor="site-name">
              <TextInput id="site-name" name="name" required minLength={2} autoFocus placeholder="HM Froid" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label={t("site.language")} htmlFor="site-locale">
              <Select id="site-locale" name="locale" value={locale} onChange={(e) => setLocale(e.target.value)}>
                {LOCALE_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </Select>
            </Field>
          </div>
          <Field label={t("site.organisation")} hint={managed.length > 1 ? t("site.transferHint") : undefined} htmlFor="site-org">
            <input type="hidden" name="organizationId" value={org} />
            <Select id="site-org" value={org} onChange={(e) => setOrg(e.target.value)} disabled={managed.length < 2}>
              {managed.map((o) => <option key={o.id} value={o.id}>{o.name}{o.companyNumber ? ` · ${o.companyNumber}` : ""}</option>)}
            </Select>
          </Field>
          <div>
            <p className="mb-2 text-[13px] font-medium">{t("site.purpose")}</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {SITE_TYPES.map((kind) => {
                const Icon = siteTypeIcon[kind] ?? Store;
                return <RadioCard key={kind} name="type" value={kind} checked={type === kind} onChange={() => setType(kind)} title={t(`types.${kind}.label`)} description={t(`types.${kind}.description`)} icon={<Icon className="size-4" />} />;
              })}
            </div>
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost">{t("cancel")}</Button></DialogClose>
            <Button type="submit" disabled={pending || !org}>{pending ? t("site.settingUp") : t("site.submit")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
