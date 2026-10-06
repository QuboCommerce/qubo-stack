"use client";

import { useActionState, useEffect, useState } from "react";
import { Building2, Globe2, Store } from "lucide-react";
import { toast } from "sonner";
import { createOrganizationAction, createSiteAction } from "@/app/provision-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, RadioCard, Select, TextInput } from "@/components/settings/controls";
import { siteTypeIcon } from "@/lib/site-type-icons";
import type { ActionState } from "@/lib/action-state";
import type { ShellOrg } from "@/components/shell/types";

export const SITE_TYPE_OPTIONS = [
  { type: "store", label: "Online store", description: "Sell products with a catalog, cart and checkout." },
  { type: "services", label: "Services & bookings", description: "Present services and take bookings: clinics, studios, coaches." },
  { type: "business", label: "Business showcase", description: "Generate leads for a company that sells offline: quotes, calls, visits." },
  { type: "editorial", label: "Blog & editorial", description: "Publish articles and grow an audience." },
  { type: "custom", label: "Custom", description: "Start empty and switch on only what you need." },
] as const;

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
  const [state, action, pending] = useActionState(createOrganizationAction, null);
  useDone(state, "Organisation created", () => onOpenChange(false));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form action={action} className="grid gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Building2 className="size-4" /> New organisation</DialogTitle>
            <DialogDescription>
              The company that owns its sites. Orders, invoices and customers are recorded under it, so one organisation per legal entity.
            </DialogDescription>
          </DialogHeader>
          <Field label="Name" htmlFor="org-name">
            <TextInput id="org-name" name="name" required minLength={2} autoFocus placeholder="TailG Belgium" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Legal name" hint="Optional" htmlFor="org-legal">
              <TextInput id="org-legal" name="legalName" placeholder="TLG Belgium SRL" />
            </Field>
            <Field label="Company number" hint="Optional" htmlFor="org-number">
              <TextInput id="org-number" name="companyNumber" placeholder="0655.678.923" />
            </Field>
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
            <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create organisation"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A site is born complete (pages, header, footer, theme) and lands you in its dashboard. */
export function CreateSiteDialog({ open, onOpenChange, orgs, defaultOrgId }: DialogProps & { orgs: ShellOrg[]; defaultOrgId?: string }) {
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
            <DialogTitle className="flex items-center gap-2"><Globe2 className="size-4" /> New site</DialogTitle>
            <DialogDescription>
              Pick what it&apos;s for and we set up the pages, header, footer and a starter theme. Everything can change later in Studio.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
            <Field label="Site name" htmlFor="site-name">
              <TextInput id="site-name" name="name" required minLength={2} autoFocus placeholder="HM Froid" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Language" htmlFor="site-locale">
              <Select id="site-locale" name="locale" value={locale} onChange={(e) => setLocale(e.target.value)}>
                {LOCALE_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Organisation" hint={managed.length > 1 ? "Drafts can be transferred between organisations; publishing fixes it." : undefined} htmlFor="site-org">
            <input type="hidden" name="organizationId" value={org} />
            <Select id="site-org" value={org} onChange={(e) => setOrg(e.target.value)} disabled={managed.length < 2}>
              {managed.map((o) => <option key={o.id} value={o.id}>{o.name}{o.companyNumber ? ` · ${o.companyNumber}` : ""}</option>)}
            </Select>
          </Field>
          <div>
            <p className="mb-2 text-[13px] font-medium">What is the site for?</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {SITE_TYPE_OPTIONS.map((t) => {
                const Icon = siteTypeIcon[t.type] ?? Store;
                return <RadioCard key={t.type} name="type" value={t.type} checked={type === t.type} onChange={() => setType(t.type)} title={t.label} description={t.description} icon={<Icon className="size-4" />} />;
              })}
            </div>
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
            <Button type="submit" disabled={pending || !org}>{pending ? "Setting up…" : "Create site"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
