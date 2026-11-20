"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Clock, Copy, ExternalLink, Link2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@qubo/shared/utils";
import { checkDomainAction, checkSharedDomainAction } from "@/app/domain-actions";
import { Button } from "@/components/ui/button";
import type { DomainRecordView, DomainView } from "@/lib/domains";

export function CopyButton({ value, label, className }: { value: string; label?: string; className?: string }) {
  const t = useTranslations("domains");
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={t("copy", { label: label ?? value })}
      onClick={async () => {
        await navigator.clipboard.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }}
      className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground", className)}
    >
      {copied ? <Check className="size-3.5 text-success" strokeWidth={2.4} /> : <Copy className="size-3.5" strokeWidth={2} />}
    </button>
  );
}

export function useAgo(iso: string | null) {
  const t = useTranslations("domains");
  const locale = useLocale();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);
  if (!iso) return t("ago.never");
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 10) return t("ago.justNow");
  if (s < 60) return t("ago.seconds", { count: s });
  if (s < 3600) return t("ago.minutes", { count: Math.floor(s / 60) });
  if (s < 86400) return t("ago.hours", { count: Math.floor(s / 3600) });
  return new Date(iso).toLocaleDateString(locale);
}

const STATUS_TONE: Record<DomainRecordView["status"], string> = {
  ok: "bg-success/12 text-success",
  missing: "bg-muted text-muted-foreground",
  wrong: "bg-warning/15 text-amber-700 dark:text-warning",
  proxied: "bg-warning/15 text-amber-700 dark:text-warning",
  ipv6: "bg-warning/15 text-amber-700 dark:text-warning",
  unknown: "bg-muted text-muted-foreground",
};

const PURPOSE_IDS = ["apex", "www", "admin", "proof"];

type T = ReturnType<typeof useTranslations<"domains">>;

function hint(r: DomainRecordView, t: T) {
  const found = r.found.join(", ");
  switch (r.status) {
    case "wrong":
      return r.type === "TXT" ? t("hint.wrongTxt", { found }) : t("hint.wrong", { found });
    case "proxied":
      return t("hint.proxied");
    case "ipv6":
      return t("hint.ipv6", { found: r.found.filter((f) => f.includes(":")).join(", ") });
    default:
      return null;
  }
}

function RecordRow({ r }: { r: DomainRecordView }) {
  const t = useTranslations("domains");
  const tone = STATUS_TONE[r.status];
  const h = hint(r, t);
  return (
    <li className="grid gap-2 px-4 py-3.5 sm:px-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-11 rounded-md bg-foreground px-1.5 py-0.5 text-center font-mono text-[10.5px] font-semibold tracking-wide text-background">{r.type}</span>
        <span className="text-[13px] text-muted-foreground">{PURPOSE_IDS.includes(r.id) ? t(`purpose.${r.id as "apex" | "www" | "admin" | "proof"}`, { fqdn: r.fqdn, value: r.value }) : r.purpose}</span>
        {!r.required && <span className="rounded-full border px-1.5 py-px text-[10.5px] text-muted-foreground">{t("recommended")}</span>}
        <span className={cn("ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium", tone)}>
          {r.status === "ok" ? <Check className="size-3" strokeWidth={2.6} /> : r.status === "missing" || r.status === "unknown" ? <Clock className="size-3" /> : <AlertTriangle className="size-3" />}
          {t(`status.${r.status}`)}
        </span>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <Cell label={t("cell.name")} value={r.name} />
        <Cell label={t("cell.value")} value={r.value} />
      </div>
      {h && <p className="text-[12.5px] leading-relaxed text-amber-700 dark:text-warning">{h}</p>}
    </li>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1 rounded-lg bg-muted/60 py-1 pr-1 pl-2.5">
      <span className="shrink-0 text-[10.5px] font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
      <code className="min-w-0 flex-1 truncate pl-1.5 font-mono text-[12.5px]" title={value}>
        {value}
      </code>
      <CopyButton value={value} label={label.toLowerCase()} />
    </div>
  );
}

/**
 * The DNS guide for one domain: where to go, what to add, and a live status per
 * record. Rendered in the admin dialog and on the public share page.
 */
export function DnsSetup({ domain, site, shareToken, shareUrl }: { domain: DomainView; site?: string; shareToken?: string; shareUrl?: string }) {
  const t = useTranslations("domains");
  const [state, check, pending] = useActionState(shareToken ? checkSharedDomainAction : checkDomainAction, null);
  const ago = useAgo(domain.checkedAt);
  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state?.error, state?.at]);
  const required = domain.records.filter((r) => r.required);
  const done = required.filter((r) => r.status === "ok").length;
  const first = domain.records[0];
  const zone = first ? (first.name === "@" ? first.fqdn : first.fqdn.slice(first.name.length + 1)) : domain.hostname;

  return (
    <div className="grid gap-4">
      {domain.verified ? (
        <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/8 px-4 py-3">
          <ShieldCheck className="mt-0.5 size-4.5 shrink-0 text-success" />
          <div className="text-sm">
            <p className="font-medium">{t("setup.connected", { hostname: domain.hostname })}</p>
            <p className="text-muted-foreground">{t("setup.connectedHelp")}</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-medium">
              {t("setup.progress", { done, total: required.length })}
            </span>
            <span className="text-muted-foreground">{t("setup.autoCheck")}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-success transition-[width] duration-700" style={{ width: `${(done / Math.max(1, required.length)) * 100}%` }} />
          </div>
        </div>
      )}

      <ProviderCard domain={domain} />

      <ul className="divide-y overflow-hidden rounded-xl border">
        {domain.records.map((r) => (
          <RecordRow key={r.id} r={r} />
        ))}
      </ul>

      <p className="text-[12.5px] leading-relaxed text-muted-foreground">
        {t.rich("setup.nameHelp", { zone, code: (c) => <code className="font-mono">{c}</code> })}
      </p>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <form action={check}>
          {site && <input type="hidden" name="site" value={site} />}
          {shareToken ? <input type="hidden" name="token" value={shareToken} /> : <input type="hidden" name="domainId" value={domain.id} />}
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" strokeWidth={2} />}
            {t("setup.checkNow")}
          </Button>
        </form>
        <span className="text-[12.5px] text-muted-foreground">
          {t("setup.lastChecked", { ago })}
          {domain.error && ` · ${t("setup.timedOut")}`}
        </span>
      </div>

      {shareUrl && (
        <div className="grid gap-1.5 rounded-xl border border-dashed px-4 py-3">
          <p className="flex items-center gap-1.5 text-[13px] font-medium">
            <Link2 className="size-3.5" /> {t("share.title")}
          </p>
          <p className="text-[12.5px] text-muted-foreground">{t("share.help")}</p>
          <div className="flex min-w-0 items-center gap-1 rounded-lg bg-muted/60 py-1 pr-1 pl-2.5">
            <code className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{shareUrl}</code>
            <CopyButton value={shareUrl} label={t("share.linkLabel")} />
          </div>
        </div>
      )}
    </div>
  );
}

function ProviderCard({ domain }: { domain: DomainView }) {
  const t = useTranslations("domains");
  const p = domain.provider;
  return (
    <div className="flex items-start gap-3 rounded-xl bg-muted/50 px-4 py-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-[13px] font-semibold shadow-sm">
        {p ? p.name.slice(0, 1) : <CheckCircle2 className="size-4 text-muted-foreground" />}
      </span>
      <div className="min-w-0 flex-1 text-sm">
        {p ? (
          <>
            <p className="font-medium">{t("provider.managedAt", { name: p.name })}</p>
            <p className="text-[13px] text-muted-foreground">
              {t.rich("provider.goTo", { where: p.where, w: (c) => <span className="text-foreground">{c}</span> })}
            </p>
            {p.note && <p className="mt-1 text-[12.5px] text-amber-700 dark:text-warning">{p.id === "cloudflare" ? t("provider.cloudflareNote") : p.note}</p>}
          </>
        ) : (
          <>
            <p className="font-medium">{t("provider.addElsewhere")}</p>
            <p className="text-[13px] text-muted-foreground">
              {t("provider.usually")}
              {domain.nameservers.length > 0 && ` ${t("provider.nameservers", { servers: domain.nameservers.slice(0, 2).join(", ") })}`}
            </p>
          </>
        )}
      </div>
      {p && (
        <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border bg-background px-2.5 text-[12.5px] font-medium hover:bg-muted">
          {t("provider.open")} <ExternalLink className="size-3" />
        </a>
      )}
    </div>
  );
}
