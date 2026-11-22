import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CHAT_AWAY_MS, siteInboundAddress } from "@qubo/inbox";
import { Inbox, ShieldAlert } from "lucide-react";
import { emailConfigured, inboundDomain } from "@qubo/inbox/server";
import { cn } from "@qubo/shared/utils";
import { aiEntitled, getAiSettings } from "@qubo/ai/server";
import { Composer } from "@/components/inbox/composer";
import { ContextPanel, type InboxAi } from "@/components/inbox/context";
import { InboxList } from "@/components/inbox/list";
import { MarkRead } from "@/components/inbox/live";
import { ContextSheet } from "@/components/inbox/message-actions";
import { ThreadMessages } from "@/components/inbox/thread";
import { ThreadToolbar } from "@/components/inbox/thread-toolbar";
import { EmptyState } from "@/components/page";
import { requireSite } from "@/lib/admin";
import {
  assignableMembers,
  getConversation,
  inboxHref,
  lensCounts,
  listConversations,
  parseLens,
  parseListOptions,
  parseView,
  viewCounts,
  type InboxState,
} from "@/lib/inbox";

type Search = Record<string, string | undefined>;

export default async function InboxPage({ params, searchParams }: { params: Promise<{ site: string; lens?: string[] }>; searchParams: Promise<Search> }) {
  const [{ site: slug, lens: segments }, sp] = await Promise.all([params, searchParams]);
  if (segments && segments.length > 1) notFound();
  const lens = parseLens(segments?.[0]);
  if (!lens) notFound();
  const { site, siteId, user } = await requireSite(slug);
  const t = await getTranslations("inbox");
  const options = parseListOptions(sp);
  const conversationId = sp.c && /^[0-9a-f-]{36}$/i.test(sp.c) ? sp.c : undefined;
  const state: InboxState = { lens, view: parseView(sp.view), c: conversationId, ...options };
  const [rows, counts, lenses, detail, members, ai] = await Promise.all([
    listConversations(siteId, lens, state.view, user.id, options),
    viewCounts(siteId, lens, user.id, options),
    lensCounts(siteId),
    conversationId ? getConversation(siteId, conversationId) : null,
    assignableMembers(site.organizationId),
    inboxAi(site.organizationId),
  ]);
  const inbound = inboundDomain();
  const inboundAddress = inbound ? siteInboundAddress(site.slug, inbound) : null;
  const href = (c?: string) => inboxHref(slug, { ...state, c });
  const at = conversationId ? rows.findIndex((r) => r.id === conversationId) : -1;
  const phone = (detail?.submission?.data as Record<string, string> | undefined)?.phone ?? null;
  const current = detail && {
    id: detail.id,
    subject: detail.subject,
    status: detail.status,
    priority: detail.priority,
    assigneeId: detail.assigneeId,
    unread: detail.unread,
    tags: detail.tags,
    ticketNumber: detail.ticketNumber,
    contactEmail: detail.contactEmail,
    contactName: detail.contactName,
    phone,
    channel: detail.channel,
    createdAt: detail.createdAt,
    snoozedUntil: detail.snoozedUntil,
  };

  return (
    <div className="flex h-[calc(100dvh-var(--qb-top)-var(--qb-tabbar))] min-h-80 flex-col md:rounded-tl-2xl md:overflow-hidden">
      <h1 className="sr-only">{t(`lenses.${lens}.title`)}</h1>
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[18rem_minmax(0,1fr)] lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[21rem_minmax(0,1fr)_19rem] 3xl:grid-cols-[23rem_minmax(0,1fr)_21rem]">
        <aside className={cn("min-h-0 flex-col bg-card md:border-r", conversationId ? "hidden md:flex" : "flex")} aria-label={t("list.label")}>
          <InboxList
            site={slug}
            me={user.id}
            state={state}
            rows={rows}
            counts={counts}
            lensCounts={lenses}
            members={members}
            current={current}
            inboundAddress={inboundAddress}
          />
        </aside>

        <section className={cn("min-h-0 flex-col bg-background", conversationId ? "flex" : "hidden md:flex")}>
          {detail && current ? (
            <>
              <MarkRead site={slug} conversationId={detail.id} unread={detail.unread} count={detail.messages.length} />
              <ThreadToolbar
                site={slug}
                me={user.id}
                c={current}
                members={members}
                backHref={href()}
                prevHref={at > 0 ? href(rows[at - 1]!.id) : null}
                nextHref={at >= 0 && at < rows.length - 1 ? href(rows[at + 1]!.id) : null}
                position={at >= 0 ? `${at + 1} / ${rows.length}` : null}
              />
              <ThreadMessages detail={detail} site={slug} me={user.id} />
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
              <div className="xl:hidden">
                <ContextSheet title={t("context.title")}>
                  <ContextPanel detail={detail} site={slug} ai={ai} members={members} />
                </ContextSheet>
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center p-6">
              {conversationId ? (
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

        <aside className="hidden min-h-0 overflow-y-auto border-l bg-card xl:block" aria-label={t("context.title")}>
          {detail && <ContextPanel detail={detail} site={slug} ai={ai} members={members} />}
        </aside>
      </div>
    </div>
  );
}

/** Null unless the plan has AI and the organisation saved a provider. */
async function inboxAi(orgId: string): Promise<InboxAi> {
  if (!(await aiEntitled(orgId))) return null;
  const s = await getAiSettings(orgId);
  return s && { triage: s.triage, drafts: s.drafts };
}

// Server-rendered snapshot; InboxLive refreshes the page on every new message.
const chatOnline = (seen: Date | null) => seen !== null && Date.now() - seen.getTime() < CHAT_AWAY_MS;
