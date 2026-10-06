"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowRightLeft, Building2, Rocket, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
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
  const [open, setOpen] = useState(false);
  const [org, setOrg] = useState(orgs.some((o) => o.id === currentOrgId) ? currentOrgId : (orgs[0]?.id ?? ""));
  const [confirmed, setConfirmed] = useState(false);
  const [state, action, pending] = useActionState(publishSiteAction, null);
  useResult(state, `${siteName} is live`, () => setOpen(false));
  const chosen = orgs.find((o) => o.id === org);

  return (
    <Dialog open={open} onOpenChange={(v) => (setOpen(v), setConfirmed(false))}>
      <DialogTrigger asChild>
        <Button size="sm"><Rocket /> Publish</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={action} className="grid gap-4">
          <input type="hidden" name="site" value={site} />
          <DialogHeader>
            <DialogTitle>Publish {siteName}</DialogTitle>
            <DialogDescription>
              The site goes live on its domains. It will belong to the organisation below for good: orders, invoices and customers are recorded under that company.
            </DialogDescription>
          </DialogHeader>
          <OrgPicker orgs={orgs} value={org} onChange={setOrg} />
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" name="confirm" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-4 accent-foreground" />
            <span>
              Publish under <span className="font-medium">{chosen?.legalName ?? chosen?.name ?? "this organisation"}</span>. I understand a published site can&apos;t be moved to another organisation.
            </span>
          </label>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
            <Button type="submit" disabled={!confirmed || !org || pending}>{pending ? "Publishing…" : "Publish"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Drafts only: free, any time, between organisations you manage. */
export function MoveDraftDialog({ site, siteName, currentOrgId, orgs }: { site: string; siteName: string; currentOrgId: string; orgs: OrgOption[] }) {
  const [open, setOpen] = useState(false);
  const others = orgs.filter((o) => o.id !== currentOrgId);
  const [org, setOrg] = useState(others[0]?.id ?? "");
  const [state, action, pending] = useActionState(moveDraftSiteAction, null);
  useResult(state, `${siteName} transferred`, () => setOpen(false));
  if (!others.length) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><ArrowRightLeft /> Transfer</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={action} className="grid gap-4">
          <input type="hidden" name="site" value={site} />
          <DialogHeader>
            <DialogTitle>Transfer {siteName}</DialogTitle>
            <DialogDescription>Drafts can be transferred freely. The site&apos;s media and the organisation&apos;s fonts come along.</DialogDescription>
          </DialogHeader>
          <OrgPicker orgs={others} value={org} onChange={setOrg} />
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
            <Button type="submit" disabled={!org || pending}>{pending ? "Transferring…" : "Transfer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Draft to the recycle bin. When the current site goes, the page moves to a site that still exists. */
export function TrashSiteButton({ siteId, siteName, isCurrent, nextHref, retentionDays }: { siteId: string; siteName: string; isCurrent: boolean; nextHref: string; retentionDays: number }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, action, pending] = useActionState(trashSiteAction, null);
  useResult(state, `${siteName} moved to the recycle bin`, () => {
    setOpen(false);
    if (isCurrent) router.replace(nextHref);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label={`Delete ${siteName}`} title="Delete" className="text-muted-foreground hover:text-destructive">
          <Trash2 />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={action} className="grid gap-4">
          <input type="hidden" name="siteId" value={siteId} />
          <DialogHeader>
            <DialogTitle>Delete {siteName}?</DialogTitle>
            <DialogDescription>
              It goes to the recycle bin at the bottom of this page, with its pages, theme, products and domains. You can restore it for {retentionDays} days; after that it is deleted for good.
            </DialogDescription>
          </DialogHeader>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
            <Button type="submit" variant="destructive" disabled={pending}>{pending ? "Deleting…" : "Delete site"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RestoreSiteButton({ siteId, siteName }: { siteId: string; siteName: string }) {
  const [state, action, pending] = useActionState(restoreSiteAction, null);
  useResult(state, `${siteName} restored`, () => {});
  return (
    <form action={action} className="contents">
      <input type="hidden" name="siteId" value={siteId} />
      <Button size="sm" variant="outline" type="submit" disabled={pending}><RotateCcw /> {pending ? "Restoring…" : "Restore"}</Button>
      {state?.error && <span className="text-xs text-destructive">{state.error}</span>}
    </form>
  );
}

/** Permanent delete before the retention period ends. */
export function PurgeSiteButton({ siteId, siteName }: { siteId: string; siteName: string }) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [state, action, pending] = useActionState(purgeSiteAction, null);
  useResult(state, `${siteName} deleted for good`, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={(v) => (setOpen(v), setConfirmed(false))}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive">Delete now</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={action} className="grid gap-4">
          <input type="hidden" name="siteId" value={siteId} />
          <DialogHeader>
            <DialogTitle>Delete {siteName} for good?</DialogTitle>
            <DialogDescription>Everything in it is removed now: pages, theme, products, customers, orders, media and domains. There is no way back.</DialogDescription>
          </DialogHeader>
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-4 accent-foreground" />
            <span>I understand this can&apos;t be undone.</span>
          </label>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
            <Button type="submit" variant="destructive" disabled={!confirmed || pending}>{pending ? "Deleting…" : "Delete for good"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
