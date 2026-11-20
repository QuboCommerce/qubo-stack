import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { CHAT_AWAY_MS, siteInboundAddress, slaState } from "@qubo/inbox";
import { ArrowLeft, Bot, FileText, Globe, Inbox, Mail, MessageCircle, Search, ShieldAlert, Ticket } from "lucide-react";
import { emailConfigured, inboundDomain } from "@qubo/inbox/server";
import { cn } from "@qubo/shared/utils";
import { aiEntitled, getAiSettings } from "@qubo/ai/server";
import { AiCard } from "@/components/inbox/ai-card";
import { Composer } from "@/components/inbox/composer";
import { MessageFiles } from "@/components/inbox/files";
import { ThreadControls } from "@/components/inbox/controls";
import { MarkRead } from "@/components/inbox/live";
import { EmptyState, Page } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { requireSite } from "@/lib/admin";
import { formatters } from "@/lib/format";
import { assignableMembers, getConversation, INBOX_VIEWS, listConversations, parseView, viewCounts, type ConversationDetail, type ConversationRow, type InboxView } from "@/lib/inbox";

const slaTone = { ok: "text-muted-foreground", warn: "bg-amber-500/10 text-amber-700 dark:text-amber-400", breach: "bg-destructive/10 text-destructive" } as const;
const channelIcon = { form: FileText, email: Mail, chat: MessageCircle, portal: Ticket, system: Bot } as const;
const priorityTone: Record<string, string> = { urgent: "bg-destructive/10 text-destructive", high: "bg-amber-500/10 text-amber-700 dark:text-amber-400" };

type Search = { view?: string; c?: string; q?: string };

export default async function InboxPage({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<Search> }) {
  const [{ site: slug }, sp] = await Promise.all([params, searchParams]);
  const { site, siteId, user } = await requireSite(slug);
  const t = await getTranslations("inbox");
  const view = parseView(sp.view);
  const conversationId = sp.c && /^[0-9a-f-]{36}$/i.test(sp.c) ? sp.c : undefined;
  const [rows, counts, detail, members, ai] = await Promise.all([
    listConversations(siteId, view, user.id, sp.q),
    viewCounts(siteId, user.id),
    conversationId ? getConversation(siteId, conversationId) : null,
    assignableMembers(site.organizationId),
    inboxAi(site.organizationId),
  ]);
  const base = `/${slug}/inbox`;
  const inbound = inboundDomain();
  const inboundAddress = inbound ? siteInboundAddress(site.slug, inbound) : null;
  const href = (next: Partial<Search>) => {
    const merged = { view, q: sp.q, c: conversationId, ...next };
    const q = new URLSearchParams();
    if (merged.view && merged.view !== "open") q.set("view", merged.view);
    if (merged.q) q.set("q", merged.q);
    if (merged.c) q.set("c", merged.c);
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };

  return (
    <Page title={t("title")} width="full" subtitle={t("subtitle")}>
      <div className="grid h-[calc(100dvh-12rem)] min-h-[28rem] overflow-hidden rounded-xl border bg-card shadow-sm md:grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)_18rem]">
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
            {rows.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">{sp.q ? t("list.noMatches") : t("list.empty")}</li>}
            {rows.map((r) => (
              <ListItem key={r.id} row={r} active={r.id === conversationId} href={href({ c: r.id })} />
            ))}
          </ul>
          {inboundAddress && (
            <p className="border-t px-3 py-2 text-xs text-muted-foreground" title={t("list.inboundAddressHint")}>
              {t.rich("list.inboundAddress", { address: inboundAddress, code: (c) => <span className="select-all font-mono text-foreground">{c}</span> })}
            </p>
          )}
        </aside>

        <section className={cn("min-h-0 flex-col", sp.c ? "flex" : "hidden md:flex")}>
          {detail ? (
            <Thread detail={detail} site={slug} backHref={href({ c: undefined })} members={members} ai={ai} />
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
  const { money, relativeTime, shortDate } = formatters(useLocale());
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
          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
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

function Thread({ detail, site, backHref, members, ai }: { detail: ConversationDetail; site: string; backHref: string; members: { id: string; name: string }[]; ai: InboxAi }) {
  const t = useTranslations("inbox");
  const { money, relativeTime, shortDate } = formatters(useLocale());
  return (
    <>
      <MarkRead site={site} conversationId={detail.id} unread={detail.unread} />
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3">
        <Link href={backHref} className="grid size-8 place-items-center rounded-lg hover:bg-accent md:hidden" aria-label={t("thread.back")}>
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">{detail.subject}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {detail.contactEmail
              ? t("thread.metaEmail", { name: detail.contactName ?? t("list.anonymous"), email: detail.contactEmail, channel: t(`channels.${detail.channel}`), date: shortDate(detail.createdAt) })
              : t("thread.meta", { name: detail.contactName ?? t("list.anonymous"), channel: t(`channels.${detail.channel}`), date: shortDate(detail.createdAt) })}
          </p>
        </div>
        <ThreadControls site={site} id={detail.id} status={detail.status} priority={detail.priority} assigneeId={detail.assigneeId} snoozedUntil={detail.snoozedUntil ? relativeTime(detail.snoozedUntil) : null} members={members} />
      </header>
      <ol className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-muted/20 p-4">
        {detail.messages.map((m) => {
          if (m.authorType === "system") {
            return (
              <li key={m.id} className="text-center text-xs text-muted-foreground">
                {m.body} · {relativeTime(m.createdAt)}
              </li>
            );
          }
          const mine = m.authorType === "staff";
          return (
            <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[min(42rem,85%)] rounded-xl border px-3.5 py-2.5 text-sm shadow-xs",
                  m.internal ? "border-amber-300/70 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30" : mine ? "bg-primary/[0.04]" : "bg-background",
                )}
              >
                <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{m.authorName ?? (mine ? t("thread.staff") : t("thread.customer"))}</span>
                  {m.internal && (
                    <Badge variant="outline" className="h-4 px-1 text-[10px]">
                      {t("thread.internalNote")}
                    </Badge>
                  )}
                  <time dateTime={m.createdAt.toISOString()}>{relativeTime(m.createdAt)}</time>
                </p>
                {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                <MessageFiles site={site} attachments={m.attachments} files={detail.files} />
                {m.deliveryError && (
                  <p className="mt-1.5 text-xs text-destructive">
                    {t(detail.channel === "chat" ? "thread.deliveryErrorChat" : "thread.deliveryError", { error: m.deliveryError })}
                  </p>
                )}
                {mine && !m.internal && m.emailMessageId && <p className="mt-1.5 text-xs text-muted-foreground">{t("thread.emailedTo", { email: detail.contactEmail ?? "" })}</p>}
                {mine && !m.internal && !m.emailMessageId && !m.deliveryError && detail.channel === "chat" && <p className="mt-1.5 text-xs text-muted-foreground">{t("thread.sentInChat")}</p>}
              </div>
            </li>
          );
        })}
      </ol>
      <Composer
        site={site}
        conversationId={detail.id}
        contactEmail={detail.contactEmail}
        emailReady={emailConfigured()}
        chat={detail.channel === "chat" ? { online: chatOnline(detail.visitorSeenAt) } : undefined}
        aiDrafts={ai?.drafts}
      />
    </>
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
      {detail.order && (
        <section>
          <h3 className={sectionTitle}>{t("context.order")}</h3>
          <Link href={`/${site}/orders`} className="hover:underline">
            #{detail.order.orderNumber} · {money(detail.order.total, detail.order.currency)}
          </Link>
        </section>
      )}
      {detail.submission && (
        <section>
          <h3 className={sectionTitle}>{t("context.formTitle", { name: detail.submission.formName })}</h3>
          <dl className="space-y-1.5">
            {Object.entries(detail.submission.data as Record<string, string>).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="break-words">{v}</dd>
              </div>
            ))}
          </dl>
          {detail.submission.pagePath && (
            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <Globe className="size-3" /> {t("context.sentFrom", { path: detail.submission.pagePath })}
            </p>
          )}
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
