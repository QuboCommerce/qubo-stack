"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Link2, Loader2, MoreHorizontal, Plus, RefreshCw, Star, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { useEvent } from "@qubo/realtime/client";
import { cn } from "@qubo/shared/utils";
import { addDomainAction, makePrimaryAction, regenerateShareLinkAction, removeDomainAction } from "@/app/domain-actions";
import { Field, TextInput } from "@/components/settings/controls";
import { Surface } from "@/components/settings/settings-group";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ActionState } from "@/lib/action-state";
import type { DomainView } from "@/lib/domains";
import { DnsSetup, useAgo } from "./dns-setup";

const TONE = {
  ok: "bg-success",
  warn: "bg-warning",
  pending: "bg-muted-foreground/40",
} as const;

/** Re-renders the page whenever the sweep (or another admin) changes a domain of this site. */
function useDomainEvents(siteId: string) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEvent("site.domain.changed", (e) => {
    if (e.siteId !== siteId) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), 250);
  });
}

function useResult(state: ActionState, onOk?: () => void) {
  useEffect(() => {
    if (state?.error) toast.error(state.error);
    else if (state?.ok) onOk?.();
  }, [state?.at, state?.error]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function DomainList({ site, siteId, domains, origin, canManage }: { site: string; siteId: string; domains: DomainView[]; origin: string; canManage: boolean }) {
  useDomainEvents(siteId);
  const [setupId, setSetupId] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [pendingHost, setPendingHost] = useState<string | null>(null);
  const setup = domains.find((d) => d.id === setupId) ?? null;

  // A freshly added domain opens its setup guide once the refreshed list includes it.
  useEffect(() => {
    if (!pendingHost) return;
    const hit = domains.find((d) => d.hostname === pendingHost);
    if (hit) {
      setSetupId(hit.id);
      setPendingHost(null);
    }
  }, [domains, pendingHost]);

  return (
    <>
      <Surface flush className="divide-y">
        {domains.map((d) => (
          <DomainRow key={d.id} site={site} domain={d} origin={origin} canManage={canManage} onSetup={() => setSetupId(d.id)} />
        ))}
        {domains.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted">
              <Globe className="size-5 text-muted-foreground" strokeWidth={1.7} />
            </span>
            <p className="text-sm font-medium">No domain yet</p>
            <p className="max-w-xs text-[13px] text-muted-foreground">Connect a domain you own. We guide you through the DNS and handle the certificate.</p>
          </div>
        )}
        {canManage && (
          <button type="button" onClick={() => setConnectOpen(true)} className="flex w-full items-center gap-2 px-4 py-3 text-left text-[13px] font-medium text-muted-foreground transition hover:bg-muted/50 hover:text-foreground sm:px-5">
            <Plus className="size-4" /> Connect domain
          </button>
        )}
      </Surface>

      <ConnectDomainDialog site={site} open={connectOpen} onOpenChange={setConnectOpen} onAdded={setPendingHost} />

      <Dialog open={!!setup} onOpenChange={(o) => !o && setSetupId(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
          {setup && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Globe className="size-4" /> {setup.hostname}
                </DialogTitle>
                <DialogDescription>{setup.verified ? "Connected. These records keep it that way." : "Add these records at your DNS provider. This page updates by itself as they appear."}</DialogDescription>
              </DialogHeader>
              <DnsSetup domain={setup} site={site} shareUrl={`${origin}${setup.sharePath}`} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function DomainRow({ site, domain: d, origin, canManage, onSetup }: { site: string; domain: DomainView; origin: string; canManage: boolean; onSetup: () => void }) {
  const ago = useAgo(d.checkedAt);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [primaryState, makePrimary, primaryPending] = useActionState(makePrimaryAction, null);
  const [shareState, newShare] = useActionState(regenerateShareLinkAction, null);
  useResult(primaryState, () => toast.success(`${d.hostname} is now the primary domain`));
  useResult(shareState, () => toast.success("New link created. The old one no longer works."));
  const fire = (dispatch: (fd: FormData) => void) => {
    const fd = new FormData();
    fd.set("site", site);
    fd.set("domainId", d.id);
    startTransition(() => dispatch(fd));
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5 sm:px-5">
      <span className={cn("relative flex size-8 shrink-0 items-center justify-center rounded-lg", d.verified ? "bg-success/12 text-success" : "bg-muted text-muted-foreground")}>
        <Globe className="size-4" strokeWidth={1.8} />
        {!d.verified && d.summary.tone !== "ok" && <span className="absolute -top-0.5 -right-0.5 size-2 animate-pulse rounded-full bg-warning ring-2 ring-card" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <a href={`https://${d.hostname}`} target="_blank" rel="noreferrer" className="truncate text-sm font-medium hover:underline">
            {d.hostname}
          </a>
          {d.isPrimary && <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10.5px] font-medium">Primary</span>}
        </div>
        <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
          <span className={cn("inline-block size-1.5 rounded-full", TONE[d.summary.tone])} />
          {d.summary.label}
          {d.checkedAt && <span className="hidden sm:inline">· checked {ago}</span>}
        </p>
      </div>
      <Button size="sm" variant={d.verified ? "ghost" : "outline"} onClick={onSetup}>
        <Wrench className="size-3.5" strokeWidth={2} />
        {d.verified ? "DNS" : "Set up"}
      </Button>
      {canManage && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="size-8" aria-label={`Actions for ${d.hostname}`}>
              {primaryPending ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {!d.isPrimary && (
              <DropdownMenuItem disabled={!d.verified} onSelect={() => fire(makePrimary)}>
                <Star className="size-4" /> Make primary
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onSelect={() => {
                void navigator.clipboard.writeText(`${origin}${d.sharePath}`);
                toast.success("Setup link copied");
              }}
            >
              <Link2 className="size-4" /> Copy setup link
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => fire(newShare)}>
              <RefreshCw className="size-4" /> New setup link
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmRemove(true)}>
              <Trash2 className="size-4" /> Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <RemoveDomainDialog site={site} domain={d} open={confirmRemove} onOpenChange={setConfirmRemove} />
    </div>
  );
}

function RemoveDomainDialog({ site, domain, open, onOpenChange }: { site: string; domain: DomainView; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [state, action, pending] = useActionState(removeDomainAction, null);
  useResult(state, () => {
    toast.success(`${domain.hostname} removed`);
    onOpenChange(false);
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form action={action} className="grid gap-4">
          <input type="hidden" name="site" value={site} />
          <input type="hidden" name="domainId" value={domain.id} />
          <DialogHeader>
            <DialogTitle>Remove {domain.hostname}?</DialogTitle>
            <DialogDescription>
              {domain.verified
                ? "Visitors on this domain stop reaching the site within a minute, and the admin stops answering on it. You can connect it again later."
                : "The domain was never connected, so nothing changes for visitors."}
              {domain.isPrimary && " Another domain becomes primary."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending && <Loader2 className="size-3.5 animate-spin" />} Remove domain
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ConnectDomainDialog({ site, open, onOpenChange, onAdded }: { site: string; open: boolean; onOpenChange: (o: boolean) => void; onAdded: (hostname: string) => void }) {
  const [state, action, pending] = useActionState(addDomainAction, null);
  const [value, setValue] = useState("");
  const submitted = useRef("");
  useEffect(() => {
    if (!state?.ok) return;
    onOpenChange(false);
    const host = submitted.current.trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").split(/[/:?#]/)[0]!.replace(/\.$/, "");
    onAdded(host);
    setValue("");
  }, [state?.ok, state?.at]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form action={action} onSubmit={() => (submitted.current = value)} className="grid gap-4">
          <input type="hidden" name="site" value={site} />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="size-4" /> Connect a domain
            </DialogTitle>
            <DialogDescription>A domain you already own. Next you get the exact DNS records to add, and we check them for you.</DialogDescription>
          </DialogHeader>
          <Field label="Domain" htmlFor="domain-host" hint="Without www. A subdomain such as shop.example.be works too.">
            <TextInput id="domain-host" name="hostname" required autoFocus autoComplete="off" spellCheck={false} placeholder="example.be" value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
          {state?.error && <p className="text-[13px] text-destructive">{state.error}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={pending || !value.trim()}>
              {pending && <Loader2 className="size-3.5 animate-spin" />} Continue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
