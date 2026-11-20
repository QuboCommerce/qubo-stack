"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowRightLeft, Building2, Rocket, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { moveDraftSiteAction, publishSiteAction, purgeSiteAction, restoreSiteAction, trashSiteAction } from "@/app/site-ownership-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@qubo/shared/utils";

export type OrgOption = { id: string; name: string; legalName: string | null; companyNumber: string | null };

function OrgPicker({ orgs, value, onChange }: { orgs: OrgOption[]; value: string; onChange: (id: string) => void }) {
  return (
    <div role="radiogroup" className="grid gap-2">
      {orgs.map((o) => (
        <label
          key={o.id}
          className={cn(
            "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors",
            value === o.id ? "border-foreground/40 bg-accent/50" : "hover:bg-accent/30",
          )}
        >
          <input type="radio" name="organizationId" value={o.id} checked={value === o.id} onChange={() => onChange(o.id)} className="sr-only" />
          <Building2 className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{o.name}</span>
            {(o.legalName || o.companyNumber) && (
              <span className="block truncate text-xs text-muted-foreground">{[o.legalName, o.companyNumber].filter(Boolean).join(" · ")}</span>
            )}
          </span>
          <span className={cn("size-3.5 rounded-full border", value === o.id && "border-4 border-foreground")} />
        </label>
      ))}
    </div>
  );
}

function useResult(state: ActionState, done: string, close: () => void) {
  useEffect(() => {
    if (state?.ok) {
      toast.success(done);
      close();
    }
  }, [state?.ok, state?.at]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** First publish: the organisation is chosen and confirmed here, because it can't change afterwards. */
export function PublishSiteDialog({ site, siteName, currentOrgId, orgs }: { site: string; siteName: string; currentOrgId: string; orgs: OrgOption[] }) {
  const t = useTranslations("settings.ownership");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [org, setOrg] = useState(orgs.some((o) => o.id === currentOrgId) ? currentOrgId : (orgs[0]?.id ?? ""));
  const [confirmed, setConfirmed] = useState(false);
  const [state, action, pending] = useActionState(publishSiteAction, null);
  useResult(state, t("publish.done", { name: siteName }), () => setOpen(false));
  const chosen = orgs.find((o) => o.id === org);

  return (
    <Dialog open={open} onOpenChange={(v) => (setOpen(v), setConfirmed(false))}>
      <DialogTrigger asChild>
        <Button size="sm"><Rocket /> {t("publish.button")}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={action} className="grid gap-4">
          <input type="hidden" name="site" value={site} />
          <DialogHeader>
            <DialogTitle>{t("publish.title", { name: siteName })}</DialogTitle>
            <DialogDescription>
              {t("publish.description")}
            </DialogDescription>
          </DialogHeader>
          <OrgPicker orgs={orgs} value={org} onChange={setOrg} />
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" name="confirm" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-4 accent-foreground" />
            <span>
              {t.rich("publish.confirm", { org: chosen?.legalName ?? chosen?.name ?? t("publish.thisOrg"), b: (c) => <span className="font-medium">{c}</span> })}
            </span>
          </label>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost">{tc("cancel")}</Button></DialogClose>
            <Button type="submit" disabled={!confirmed || !org || pending}>{pending ? t("publish.publishing") : t("publish.button")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Drafts only: free, any time, between organisations you manage. */
export function MoveDraftDialog({ site, siteName, currentOrgId, orgs }: { site: string; siteName: string; currentOrgId: string; orgs: OrgOption[] }) {
  const t = useTranslations("settings.ownership");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const others = orgs.filter((o) => o.id !== currentOrgId);
  const [org, setOrg] = useState(others[0]?.id ?? "");
  const [state, action, pending] = useActionState(moveDraftSiteAction, null);
  useResult(state, t("move.done", { name: siteName }), () => setOpen(false));
  if (!others.length) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><ArrowRightLeft /> {t("move.button")}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={action} className="grid gap-4">
          <input type="hidden" name="site" value={site} />
          <DialogHeader>
            <DialogTitle>{t("move.title", { name: siteName })}</DialogTitle>
            <DialogDescription>{t("move.description")}</DialogDescription>
          </DialogHeader>
          <OrgPicker orgs={others} value={org} onChange={setOrg} />
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost">{tc("cancel")}</Button></DialogClose>
            <Button type="submit" disabled={!org || pending}>{pending ? t("move.moving") : t("move.button")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Draft to the recycle bin. When the current site goes, the page moves to a site that still exists. */
export function TrashSiteButton({ siteId, siteName, isCurrent, nextHref, retentionDays }: { siteId: string; siteName: string; isCurrent: boolean; nextHref: string; retentionDays: number }) {
  const t = useTranslations("settings.ownership");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, action, pending] = useActionState(trashSiteAction, null);
  useResult(state, t("trash.done", { name: siteName }), () => {
    setOpen(false);
    if (isCurrent) router.replace(nextHref);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label={t("trash.label", { name: siteName })} title={tc("delete")} className="text-muted-foreground hover:text-destructive">
          <Trash2 />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={action} className="grid gap-4">
          <input type="hidden" name="siteId" value={siteId} />
          <DialogHeader>
            <DialogTitle>{t("trash.title", { name: siteName })}</DialogTitle>
            <DialogDescription>
              {t("trash.description", { days: retentionDays })}
            </DialogDescription>
          </DialogHeader>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost">{tc("cancel")}</Button></DialogClose>
            <Button type="submit" variant="destructive" disabled={pending}>{pending ? t("deleting") : t("trash.confirm")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RestoreSiteButton({ siteId, siteName }: { siteId: string; siteName: string }) {
  const t = useTranslations("settings.ownership");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState(restoreSiteAction, null);
  useResult(state, t("restore.done", { name: siteName }), () => {});
  return (
    <form action={action} className="contents">
      <input type="hidden" name="siteId" value={siteId} />
      <Button size="sm" variant="outline" type="submit" disabled={pending}><RotateCcw /> {pending ? t("restore.restoring") : t("restore.button")}</Button>
      {state?.error && <span className="text-xs text-destructive">{state.error}</span>}
    </form>
  );
}

/** Permanent delete before the retention period ends. */
export function PurgeSiteButton({ siteId, siteName }: { siteId: string; siteName: string }) {
  const t = useTranslations("settings.ownership");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [state, action, pending] = useActionState(purgeSiteAction, null);
  useResult(state, t("purge.done", { name: siteName }), () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={(v) => (setOpen(v), setConfirmed(false))}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive">{t("purge.button")}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={action} className="grid gap-4">
          <input type="hidden" name="siteId" value={siteId} />
          <DialogHeader>
            <DialogTitle>{t("purge.title", { name: siteName })}</DialogTitle>
            <DialogDescription>{t("purge.description")}</DialogDescription>
          </DialogHeader>
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-4 accent-foreground" />
            <span>{t("purge.confirm")}</span>
          </label>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost">{tc("cancel")}</Button></DialogClose>
            <Button type="submit" variant="destructive" disabled={!confirmed || pending}>{pending ? t("deleting") : t("purge.confirmButton")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
