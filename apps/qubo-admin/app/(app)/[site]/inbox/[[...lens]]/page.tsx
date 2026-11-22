import Link from "next/link";
import { notFound } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { CHAT_AWAY_MS, siteInboundAddress, slaState } from "@qubo/inbox";
import { Inbox, Search, ShieldAlert, Ticket } from "lucide-react";
import { emailConfigured, inboundDomain } from "@qubo/inbox/server";
import { cn } from "@qubo/shared/utils";
import { aiEntitled, getAiSettings } from "@qubo/ai/server";
import { AiCard } from "@/components/inbox/ai-card";
import { Composer } from "@/components/inbox/composer";
import { MarkRead } from "@/components/inbox/live";
import { channelIcon, ThreadHeader, ThreadMessages } from "@/components/inbox/thread";
import { EmptyState, Page } from "@/components/page";
import { requireSite } from "@/lib/admin";
import { formatters } from "@/lib/format";
import {
  assignableMembers,
  getConversation,
  INBOX_LENSES,
  INBOX_VIEWS,
  lensCounts,
  listConversations,
  parseLens,
  parseView,
  viewCounts,
  type ConversationDetail,
  type ConversationRow,
  type InboxLens,
} from "@/lib/inbox";

const slaTone = { ok: "text-muted-foreground", warn: "bg-amber-500/10 text-amber-700 dark:text-amber-400", breach: "bg-destructive/10 text-destructive" } as const;
const priorityTone: Record<string, string> = { urgent: "bg-destructive/10 text-destructive", high: "bg-amber-500/10 text-amber-700 dark:text-amber-400" };

type Search = { view?: string; c?: string; q?: string };

export default async function InboxPage({ params, searchParams }: { params: Promise<{ site: string; lens?: string[] }>; searchParams: Promise<Search> }) {
  const [{ site: slug, lens: segments }, sp] = await Promise.all([params, searchParams]);
  if (segments && segments.length > 1) notFound();
  const lens = parseLens(segments?.[0]);
  if (!lens) notFound();
  const { site, siteId, user } = await requireSite(slug);
  const t = await getTranslations("inbox");
  const view = parseView(sp.view);
  const conversationId = sp.c && /^[0-9a-f-]{36}$/i.test(sp.c) ? sp.c : undefined;
  const [rows, counts, lenses, detail, members, ai] = await Promise.all([
    listConversations(siteId, lens, view, user.id, sp.q),
    viewCounts(siteId, lens, user.id),
    lensCounts(siteId),
    conversationId ? getConversation(siteId, conversationId) : null,
    assignableMembers(site.organizationId),
    inboxAi(site.organizationId),
  ]);
  const root = `/${slug}/inbox`;
  const lensBase = (l: InboxLens) => (l === "all" ? root : `${root}/${l}`);
  const base = lensBase(lens);
  const inbound = inboundDomain();
  const inboundAddress = inbound ? siteInboundAddress(site.slug, inbound) : null;
  const href = (next: Partial<Search>, path = base) => {
    const merged = { view, q: sp.q, c: conversationId, ...next };
    const q = new URLSearchParams();
    if (merged.view && merged.view !== "open") q.set("view", merged.view);
    if (merged.q) q.set("q", merged.q);
    if (merged.c) q.set("c", merged.c);
    const s = q.toString();
    return s ? `${path}?${s}` : path;
  };

  return (
    <Page title={t(`lenses.${lens}.title`)} width="full" subtitle={t(`lenses.${lens}.subtitle`)}>
      <nav aria-label={t("lenses.label")} className="-mt-2 mb-3 flex gap-1 overflow-x-auto pb-1">
        {INBOX_LENSES.map((l) => (
          <Link
            key={l}
            href={href({ c: undefined }, lensBase(l))}
            aria-current={l === lens ? "page" : undefined}
            className={cn(
              "flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors hover:bg-accent",
              l === lens ? "border-foreground bg-foreground text-background hover:bg-foreground/90" : "bg-background",
            )}
          >
            {t(`lenses.${l}.tab`)}
            {lenses[l] > 0 && <span className={cn("text-xs tabular-nums", l === lens ? "text-background/70" : "text-muted-foreground")}>{lenses[l]}</span>}
          </Link>
        ))}
      </nav>
      <div className="grid grid-cols-1 h-[calc(100dvh-14rem)] min-h-[28rem] overflow-hidden rounded-xl border bg-card shadow-sm md:grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)_18rem]">
        <aside className={cn("min-h-0 flex-col border-r", sp.c ? "hidden md:flex" : "flex")}>
          <form action={base} className="border-b p-2">
            {view !== "open" && <input type="hidden" name="view" value={view} />}
            <label className="flex items-center gap-2 rounded-lg border bg-background px-2.5">
              <Search className="size-4 text-muted-foreground" />
              <input name="q" defaultValue={sp.q} placeholder={t("list.searchPlaceholder")} className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </label>
          </form>
          <nav className="flex gap-1 overflow-x-auto border-b px-2 py-1.5 text-[13px]">
            {INBOX_VIEWS.map((v) => (
              <Link key={v} href={href({ view: v, c: undefined })} className={cn("shrink-0 rounded-md px-2 py-1 hover:bg-accent", v === view && "bg-accent font-medium")}>
                {t(`views.${v}`)}
                {v !== "all" && counts[v] > 0 && <span className="ml-1 text-muted-foreground">{counts[v]}</span>}
              </Link>
            ))}
          </nav>
          <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
            {rows.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">{sp.q ? t("list.noMatches") : t(`lenses.${lens}.empty`)}</li>}
            {rows.map((r) => (
              <ListItem key={r.id} row={r} active={r.id === conversationId} href={href({ c: r.id })} />
            ))}
          </ul>
          {inboundAddress && (lens === "all" || lens === "email") && (
            <p className="border-t px-3 py-2 text-xs text-muted-foreground" title={t("list.inboundAddressHint")}>
              {t.rich("list.inboundAddress", { address: inboundAddress, code: (c) => <span className="select-all font-mono text-foreground">{c}</span> })}
            </p>
          )}
        </aside>

        <section className={cn("min-h-0 flex-col", sp.c ? "flex" : "hidden md:flex")}>
          {detail ? (
            <>
              <MarkRead site={slug} conversationId={detail.id} unread={detail.unread} />
              <ThreadHeader detail={detail} site={slug} backHref={href({ c: undefined })} members={members} />
              <ThreadMessages detail={detail} site={slug} />
              <Composer
                key={detail.id}
                site={slug}
                conversationId={detail.id}
                contactEmail={detail.contactEmail}
                participants={detail.participants}
                emailReady={emailConfigured()}
                chat={detail.channel === "chat" ? { online: chatOnline(detail.visitorSeenAt) } : undefined}
                ticket={detail.ticketNumber !== null}
                aiDrafts={ai?.drafts}
              />
            </>
          ) : (
            <div className="grid flex-1 place-items-center p-6">
              {sp.c ? (
                <EmptyState icon={ShieldAlert} title={t("empty.notFoundTitle")} description={t("empty.notFoundDescription")} />
              ) : (
                <EmptyState
                  icon={Inbox}
                  title={rows.length ? t("empty.pickTitle") : t("empty.noneTitle")}
                  description={
                    rows.length
                      ? t("empty.pickDescription")
                      : inboundAddress
                        ? t("empty.noneDescriptionForward", { address: inboundAddress })
                        : t("empty.noneDescription")
                  }
                />
              )}
            </div>
          )}
        </section>

        <aside className="hidden min-h-0 overflow-y-auto border-l xl:block">{detail && <Context detail={detail} site={slug} ai={ai} />}</aside>
      </div>
    </Page>
  );
}

function waitLabelKey(ms: number): { key: "waitMinutes" | "waitHours" | "waitDays"; count: number } {
  if (ms < 3_600_000) return { key: "waitMinutes", count: Math.max(1, Math.round(ms / 60_000)) };
  if (ms < 48 * 3_600_000) return { key: "waitHours", count: Math.round(ms / 3_600_000) };
  return { key: "waitDays", count: Math.round(ms / 86_400_000) };
}

function ListItem({ row, active, href }: { row: ConversationRow; active: boolean; href: string }) {
  const t = useTranslations("inbox");
  const { relativeTime } = formatters(useLocale());
  const waitLabel = (ms: number) => {
    const w = waitLabelKey(ms);
    return t(`list.${w.key}`, { count: w.count });
  };
  const Icon = channelIcon[row.channel];
  const sla = slaState(row.status, row.lastFrom, row.lastMessageAt);
  const category = row.tags.find((t) => t.startsWith("ai:"))?.slice(3);
  return (
    <li>
      <Link href={href} scroll={false} className={cn("block px-3 py-2.5 hover:bg-accent/50", active && "bg-accent")}>
        <div className="flex items-center gap-2">
          {row.unread && <span className="size-2 shrink-0 rounded-full bg-brand-hot" aria-label={t("list.unread")} />}
          <p className={cn("min-w-0 flex-1 truncate text-sm", row.unread && "font-semibold")}>{row.contactName ?? row.contactEmail ?? t("list.anonymous")}</p>
          <time className="shrink-0 text-xs text-muted-foreground" dateTime={row.lastMessageAt.toISOString()}>
            {relativeTime(row.lastMessageAt)}
          </time>
        </div>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-[13px]">
          <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-label={t(`origins.${row.channel}`)} />
          {row.ticketNumber !== null && (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-foreground px-1 text-[11px] font-semibold tabular-nums text-background">
              <Ticket className="size-3" />#{row.ticketNumber}
            </span>
          )}
          <span className="truncate">{row.subject}</span>
          {row.tags.includes("spam") && <span className="shrink-0 rounded bg-destructive/10 px-1 text-[11px] font-medium text-destructive">{t("list.spam")}</span>}
          {category && <span className="shrink-0 rounded bg-violet-500/10 px-1 text-[11px] font-medium text-violet-700 dark:text-violet-300">{category}</span>}
          {priorityTone[row.priority] && <span className={cn("shrink-0 rounded px-1 text-[11px] font-medium", priorityTone[row.priority])}>{t(`priorities.${row.priority as "low"}`)}</span>}
          {sla && sla.level !== "ok" && (
            <span className={cn("shrink-0 rounded px-1 text-[11px] font-medium", slaTone[sla.level])} title={t("list.waitingHint")}>
              {t("list.waiting", { time: waitLabel(sla.waitingMs) })}
            </span>
          )}
          {row.status === "snoozed" && row.snoozedUntil && <span className="shrink-0 text-[11px] text-muted-foreground">{t("list.wakes", { time: relativeTime(row.snoozedUntil) })}</span>}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {row.lastFrom === "staff" && t("list.you")}
          {row.preview}
        </p>
      </Link>
    </li>
  );
}

type InboxAi = { triage: boolean; drafts: boolean } | null;

/** Null unless the plan has AI and the organisation saved a provider. */
async function inboxAi(orgId: string): Promise<InboxAi> {
  if (!(await aiEntitled(orgId))) return null;
  const s = await getAiSettings(orgId);
  return s && { triage: s.triage, drafts: s.drafts };
}

// Server-rendered snapshot; InboxLive refreshes the page on every new message.
const chatOnline = (seen: Date | null) => seen !== null && Date.now() - seen.getTime() < CHAT_AWAY_MS;

const sectionTitle = "mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground";

function Context({ detail, site, ai }: { detail: ConversationDetail; site: string; ai: InboxAi }) {
  const t = useTranslations("inbox");
  const { money, relativeTime, shortDate } = formatters(useLocale());
  const copied = [...detail.participants.cc, ...detail.participants.bcc.map((a) => `${a} (${t("composer.recipients.bcc")})`)];
  return (
    <div className="space-y-5 p-4 text-sm">
      {ai && <AiCard site={site} conversationId={detail.id} ai={detail.ai} triage={ai.triage} />}
      <section>
        <h3 className={sectionTitle}>{t("context.contact")}</h3>
        <p className="font-medium">{detail.contactName ?? t("list.anonymous")}</p>
        {detail.contactEmail && (
          <a href={`mailto:${detail.contactEmail}`} className="text-[13px] text-muted-foreground hover:underline">
            {detail.contactEmail}
          </a>
        )}
        {detail.customer && <p className="mt-1 text-xs text-muted-foreground">{t("context.customerSince", { date: shortDate(detail.customer.createdAt) })}</p>}
      </section>
      {copied.length > 0 && (
        <section>
          <h3 className={sectionTitle}>{t("context.copied")}</h3>
          <ul className="space-y-0.5 text-[13px] text-muted-foreground">
            {copied.map((a) => (
              <li key={a} className="truncate">
                {a}
              </li>
            ))}
          </ul>
        </section>
      )}
      {detail.order && (
        <section>
          <h3 className={sectionTitle}>{t("context.order")}</h3>
          <Link href={`/${site}/orders`} className="hover:underline">
            #{detail.order.orderNumber} · {money(detail.order.total, detail.order.currency)}
          </Link>
        </section>
      )}
      {detail.history.length > 0 && (
        <section>
          <h3 className={sectionTitle}>{t("context.earlier")}</h3>
          <ul className="space-y-1.5">
            {detail.history.map((h) => (
              <li key={h.id}>
                <Link href={`/${site}/inbox?view=all&c=${h.id}`} className="block truncate hover:underline">
                  {h.subject}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {t(`statuses.${h.status as "open"}`)} · {relativeTime(h.lastMessageAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
