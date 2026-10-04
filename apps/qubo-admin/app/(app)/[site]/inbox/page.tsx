import Link from "next/link";
import { ArrowLeft, Bot, FileText, Globe, Inbox, Mail, MessageCircle, Search, ShieldAlert, Ticket } from "lucide-react";
import { emailConfigured } from "@qubo/inbox/server";
import { cn } from "@qubo/shared/utils";
import { Composer } from "@/components/inbox/composer";
import { ThreadControls } from "@/components/inbox/controls";
import { MarkRead } from "@/components/inbox/live";
import { EmptyState, Page } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { requireSite } from "@/lib/admin";
import { money, relativeTime, shortDate } from "@/lib/format";
import { assignableMembers, getConversation, INBOX_VIEWS, listConversations, parseView, viewCounts, type ConversationDetail, type ConversationRow, type InboxView } from "@/lib/inbox";

const viewLabel: Record<InboxView, string> = { open: "Open", mine: "Mine", pending: "Pending", resolved: "Resolved", all: "All" };
const channelIcon = { form: FileText, email: Mail, chat: MessageCircle, portal: Ticket, system: Bot } as const;
const priorityTone: Record<string, string> = { urgent: "bg-destructive/10 text-destructive", high: "bg-amber-500/10 text-amber-700 dark:text-amber-400" };

type Search = { view?: string; c?: string; q?: string };

export default async function InboxPage({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<Search> }) {
  const [{ site: slug }, sp] = await Promise.all([params, searchParams]);
  const { site, siteId, user } = await requireSite(slug);
  const view = parseView(sp.view);
  const conversationId = sp.c && /^[0-9a-f-]{36}$/i.test(sp.c) ? sp.c : undefined;
  const [rows, counts, detail, members] = await Promise.all([
    listConversations(siteId, view, user.id, sp.q),
    viewCounts(siteId, user.id),
    conversationId ? getConversation(siteId, conversationId) : null,
    assignableMembers(site.organizationId),
  ]);
  const base = `/${slug}/inbox`;
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
    <Page title="Inbox" width="full" subtitle="Messages from your site's forms, e-mail and chat, in one place.">
      <div className="grid h-[calc(100dvh-12rem)] min-h-[28rem] overflow-hidden rounded-xl border bg-card shadow-sm md:grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)_18rem]">
        <aside className={cn("min-h-0 flex-col border-r", sp.c ? "hidden md:flex" : "flex")}>
          <form action={base} className="border-b p-2">
            {view !== "open" && <input type="hidden" name="view" value={view} />}
            <label className="flex items-center gap-2 rounded-lg border bg-background px-2.5">
              <Search className="size-4 text-muted-foreground" />
              <input name="q" defaultValue={sp.q} placeholder="Search subject, name, e-mail" className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </label>
          </form>
          <nav className="flex gap-1 overflow-x-auto border-b px-2 py-1.5 text-[13px]">
            {INBOX_VIEWS.map((v) => (
              <Link key={v} href={href({ view: v, c: undefined })} className={cn("shrink-0 rounded-md px-2 py-1 hover:bg-accent", v === view && "bg-accent font-medium")}>
                {viewLabel[v]}
                {v !== "all" && counts[v] > 0 && <span className="ml-1 text-muted-foreground">{counts[v]}</span>}
              </Link>
            ))}
          </nav>
          <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
            {rows.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">{sp.q ? "No matches." : "Nothing here."}</li>}
            {rows.map((r) => (
              <ListItem key={r.id} row={r} active={r.id === conversationId} href={href({ c: r.id })} />
            ))}
          </ul>
        </aside>

        <section className={cn("min-h-0 flex-col", sp.c ? "flex" : "hidden md:flex")}>
          {detail ? (
            <Thread detail={detail} site={slug} backHref={href({ c: undefined })} members={members} />
          ) : (
            <div className="grid flex-1 place-items-center p-6">
              {sp.c ? (
                <EmptyState icon={ShieldAlert} title="Conversation not found" description="It may have been removed, or it belongs to another site." />
              ) : (
                <EmptyState
                  icon={Inbox}
                  title={rows.length ? "Pick a conversation" : "No conversations yet"}
                  description={
                    rows.length
                      ? "Select a conversation on the left to read and reply."
                      : "Contact-form submissions show up here. Add a Contact form block to a page to start receiving messages."
                  }
                />
              )}
            </div>
          )}
        </section>

        <aside className="hidden min-h-0 overflow-y-auto border-l xl:block">{detail && <Context detail={detail} site={slug} />}</aside>
      </div>
    </Page>
  );
}

function ListItem({ row, active, href }: { row: ConversationRow; active: boolean; href: string }) {
  const Icon = channelIcon[row.channel];
  return (
    <li>
      <Link href={href} scroll={false} className={cn("block px-3 py-2.5 hover:bg-accent/50", active && "bg-accent")}>
        <div className="flex items-center gap-2">
          {row.unread && <span className="size-2 shrink-0 rounded-full bg-brand-hot" aria-label="Unread" />}
          <p className={cn("min-w-0 flex-1 truncate text-sm", row.unread && "font-semibold")}>{row.contactName ?? row.contactEmail ?? "Anonymous"}</p>
          <time className="shrink-0 text-xs text-muted-foreground" dateTime={row.lastMessageAt.toISOString()}>
            {relativeTime(row.lastMessageAt)}
          </time>
        </div>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-[13px]">
          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{row.subject}</span>
          {priorityTone[row.priority] && <span className={cn("shrink-0 rounded px-1 text-[11px] font-medium", priorityTone[row.priority])}>{row.priority}</span>}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {row.lastFrom === "staff" && "You: "}
          {row.preview}
        </p>
      </Link>
    </li>
  );
}

function Thread({ detail, site, backHref, members }: { detail: ConversationDetail; site: string; backHref: string; members: { id: string; name: string }[] }) {
  return (
    <>
      <MarkRead site={site} conversationId={detail.id} unread={detail.unread} />
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3">
        <Link href={backHref} className="grid size-8 place-items-center rounded-lg hover:bg-accent md:hidden" aria-label="Back to list">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">{detail.subject}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {detail.contactName ?? "Anonymous"}
            {detail.contactEmail && <> · {detail.contactEmail}</>} · via {detail.channel} · {shortDate(detail.createdAt)}
          </p>
        </div>
        <ThreadControls site={site} id={detail.id} status={detail.status} priority={detail.priority} assigneeId={detail.assigneeId} members={members} />
      </header>
      <ol className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-muted/20 p-4">
        {detail.messages.map((m) => {
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
                  <span className="font-medium text-foreground">{m.authorName ?? (mine ? "Staff" : "Customer")}</span>
                  {m.internal && (
                    <Badge variant="outline" className="h-4 px-1 text-[10px]">
                      Internal note
                    </Badge>
                  )}
                  <time dateTime={m.createdAt.toISOString()}>{relativeTime(m.createdAt)}</time>
                </p>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                {m.deliveryError && <p className="mt-1.5 text-xs text-destructive">Not e-mailed: {m.deliveryError}</p>}
                {mine && !m.internal && m.emailMessageId && <p className="mt-1.5 text-xs text-muted-foreground">E-mailed to {detail.contactEmail}</p>}
              </div>
            </li>
          );
        })}
      </ol>
      <Composer site={site} conversationId={detail.id} contactEmail={detail.contactEmail} emailReady={emailConfigured()} />
    </>
  );
}

const sectionTitle = "mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground";

function Context({ detail, site }: { detail: ConversationDetail; site: string }) {
  return (
    <div className="space-y-5 p-4 text-sm">
      <section>
        <h3 className={sectionTitle}>Contact</h3>
        <p className="font-medium">{detail.contactName ?? "Anonymous"}</p>
        {detail.contactEmail && (
          <a href={`mailto:${detail.contactEmail}`} className="text-[13px] text-muted-foreground hover:underline">
            {detail.contactEmail}
          </a>
        )}
        {detail.customer && <p className="mt-1 text-xs text-muted-foreground">Customer since {shortDate(detail.customer.createdAt)}</p>}
      </section>
      {detail.order && (
        <section>
          <h3 className={sectionTitle}>Order</h3>
          <Link href={`/${site}/orders`} className="hover:underline">
            #{detail.order.orderNumber} · {money(detail.order.total, detail.order.currency)}
          </Link>
        </section>
      )}
      {detail.submission && (
        <section>
          <h3 className={sectionTitle}>{detail.submission.formName} form</h3>
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
              <Globe className="size-3" /> Sent from {detail.submission.pagePath}
            </p>
          )}
        </section>
      )}
      {detail.history.length > 0 && (
        <section>
          <h3 className={sectionTitle}>Earlier conversations</h3>
          <ul className="space-y-1.5">
            {detail.history.map((h) => (
              <li key={h.id}>
                <Link href={`/${site}/inbox?view=all&c=${h.id}`} className="block truncate hover:underline">
                  {h.subject}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {h.status} · {relativeTime(h.lastMessageAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
