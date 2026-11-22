import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { splitQuoted } from "@qubo/inbox";
import { ArrowLeft, Bot, FileText, Globe, Languages, Mail, MessageCircle, Reply, StickyNote, Ticket, TicketPlus } from "lucide-react";
import { cn } from "@qubo/shared/utils";
import { escalateFormAction } from "@/app/inbox-actions";
import { ComposeButton } from "@/components/inbox/compose-button";
import { ThreadControls } from "@/components/inbox/controls";
import { MessageFiles } from "@/components/inbox/files";
import { Button } from "@/components/ui/button";
import { formatters } from "@/lib/format";
import type { ConversationDetail } from "@/lib/inbox";

export const channelIcon = { form: FileText, email: Mail, chat: MessageCircle, portal: Ticket, system: Bot } as const;

type Msg = ConversationDetail["messages"][number];

/** Thread header: subject, origin, ticket number and the controls. */
export function ThreadHeader({ detail, site, backHref, members }: { detail: ConversationDetail; site: string; backHref: string; members: { id: string; name: string }[] }) {
  const t = useTranslations("inbox");
  const { relativeTime, shortDate } = formatters(useLocale());
  const Icon = channelIcon[detail.channel];
  const name = detail.contactName ?? t("list.anonymous");
  return (
    <header className="space-y-2 border-b px-4 py-3">
      <div className="flex items-start gap-2">
        <Link href={backHref} className="-ml-1 grid size-8 shrink-0 place-items-center rounded-lg hover:bg-accent md:hidden" aria-label={t("thread.back")}>
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {detail.ticketNumber && (
              <span className="inline-flex h-5 items-center gap-1 rounded-md bg-foreground px-1.5 text-[11px] font-semibold tabular-nums text-background">
                <Ticket className="size-3" /> #{detail.ticketNumber}
              </span>
            )}
            <span className="inline-flex h-5 items-center gap-1 rounded-md border px-1.5 text-[11px] text-muted-foreground">
              <Icon className="size-3" /> {t(`origins.${detail.channel}`)}
            </span>
          </div>
          <h2 className="mt-1 truncate font-semibold">{detail.subject}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {detail.contactEmail ? `${name} · ${detail.contactEmail}` : name} · {shortDate(detail.createdAt)}
          </p>
        </div>
        {!detail.ticketNumber && (
          <form action={escalateFormAction}>
            <input type="hidden" name="site" value={site} />
            <input type="hidden" name="id" value={detail.id} />
            <Button type="submit" size="sm" variant="outline" title={t("thread.makeTicketHint")}>
              <TicketPlus /> <span className="hidden sm:inline">{t("thread.makeTicket")}</span>
            </Button>
          </form>
        )}
      </div>
      <ThreadControls site={site} id={detail.id} status={detail.status} priority={detail.priority} assigneeId={detail.assigneeId} snoozedUntil={detail.snoozedUntil ? relativeTime(detail.snoozedUntil) : null} members={members} />
    </header>
  );
}

/**
 * The conversation, drawn for where it came from: a form post is a card, an
 * e-mail reads like a letter with its addresses, a chat is bubbles. Every
 * message is stored the same way; only this layer interprets it.
 */
export function ThreadMessages({ detail, site }: { detail: ConversationDetail; site: string }) {
  const chat = detail.channel === "chat";
  // The form post is the first customer message of a form thread.
  const formMessageId = detail.submission ? detail.messages.find((m) => m.authorType === "customer")?.id : undefined;
  return (
    <ol className={cn("min-h-0 flex-1 overflow-y-auto bg-muted/20 p-3 sm:p-4", chat ? "space-y-2" : "space-y-3")}>
      {detail.messages.map((m) => (
        <li key={m.id}>
          {m.authorType === "system" ? (
            <SystemLine m={m} />
          ) : m.id === formMessageId ? (
            <FormCard detail={detail} site={site} m={m} />
          ) : m.internal ? (
            <Note m={m} site={site} detail={detail} />
          ) : chat ? (
            <Bubble m={m} site={site} detail={detail} />
          ) : (
            <Letter m={m} site={site} detail={detail} />
          )}
        </li>
      ))}
    </ol>
  );
}

function SystemLine({ m }: { m: Msg }) {
  const t = useTranslations("inbox.thread");
  const { relativeTime } = formatters(useLocale());
  const ticket = m.body.match(/^ticket:(\d+)$/);
  return (
    <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
      {ticket ? (
        <>
          <Ticket className="size-3" /> {t("escalated", { number: ticket[1]!, name: m.authorName ?? t("staff") })}
        </>
      ) : (
        m.body
      )}
      <span>· {relativeTime(m.createdAt)}</span>
    </p>
  );
}

const FIELD_ORDER = ["name", "company", "email", "phone", "address", "message"];
const isLong = (k: string, v: string) => k === "message" || v.length > 80 || v.includes("\n");

function FormCard({ detail, site, m }: { detail: ConversationDetail; site: string; m: Msg }) {
  const t = useTranslations("inbox");
  const { relativeTime } = formatters(useLocale());
  const sub = detail.submission!;
  const entries = Object.entries(sub.data as Record<string, string>).sort(([a], [b]) => {
    const ia = FIELD_ORDER.indexOf(a), ib = FIELD_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const label = (k: string) => (t.has(`fields.${k}` as "fields.name") ? t(`fields.${k}` as "fields.name") : k.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase()));
  const value = (k: string, v: string) =>
    k === "email" ? (
      <a href={`mailto:${v}`} className="hover:underline">{v}</a>
    ) : k === "phone" ? (
      <a href={`tel:${v.replace(/[^\d+]/g, "")}`} className="hover:underline">{v}</a>
    ) : (
      v
    );
  return (
    <article className="overflow-hidden rounded-xl border bg-background shadow-xs">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <FileText className="size-3.5" /> {t("context.formTitle", { name: sub.formName })}
        </span>
        {sub.pagePath && (
          <span className="flex items-center gap-1">
            <Globe className="size-3" /> {sub.pagePath}
          </span>
        )}
        {sub.locale && (
          <span className="flex items-center gap-1 uppercase">
            <Languages className="size-3" /> {sub.locale}
          </span>
        )}
        <time className="ml-auto" dateTime={m.createdAt.toISOString()}>{relativeTime(m.createdAt)}</time>
      </header>
      <dl className="grid gap-x-6 gap-y-3 px-4 py-3 text-sm sm:grid-cols-2">
        {entries.map(([k, v]) => (
          <div key={k} className={cn("min-w-0", isLong(k, v) && "sm:col-span-2")}>
            <dt className="text-xs text-muted-foreground">{label(k)}</dt>
            <dd className={cn("break-words", isLong(k, v) && "mt-0.5 whitespace-pre-wrap rounded-lg bg-muted/40 px-3 py-2")}>{value(k, v)}</dd>
          </div>
        ))}
      </dl>
      <MessageFilesWrap site={site} m={m} detail={detail} />
      <footer className="flex flex-wrap gap-2 border-t px-4 py-2.5">
        {detail.contactEmail && (
          <ComposeButton mode="reply" variant="default">
            <Reply /> {t("thread.replyByEmail")}
          </ComposeButton>
        )}
        <ComposeButton mode="note">
          <StickyNote /> {t("thread.addNote")}
        </ComposeButton>
        {!detail.ticketNumber && (
          <form action={escalateFormAction}>
            <input type="hidden" name="site" value={site} />
            <input type="hidden" name="id" value={detail.id} />
            <Button type="submit" size="sm" variant="ghost">
              <TicketPlus /> {t("thread.makeTicket")}
            </Button>
          </form>
        )}
      </footer>
    </article>
  );
}

function MessageFilesWrap({ site, m, detail }: { site: string; m: Msg; detail: ConversationDetail }) {
  if (!m.attachments.length) return null;
  return (
    <div className="px-4 pb-3">
      <MessageFiles site={site} attachments={m.attachments} files={detail.files} />
    </div>
  );
}

const initials = (name: string) =>
  name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

/** Body of a message: our own rich HTML for staff replies, otherwise text with the quoted trail folded away. */
function Body({ m }: { m: Msg }) {
  const t = useTranslations("inbox.thread");
  // bodyHtml on staff rows is rendered by docToHtml from an allowlist; customer HTML is never rendered.
  if (m.authorType === "staff" && m.bodyHtml) return <div className="qb-rich break-words" dangerouslySetInnerHTML={{ __html: m.bodyHtml }} />;
  if (!m.body) return null;
  const { fresh, quoted } = splitQuoted(m.body);
  return (
    <>
      <p className="whitespace-pre-wrap break-words">{fresh}</p>
      {quoted && (
        <details className="group mt-2">
          <summary className="inline-flex cursor-pointer list-none items-center rounded-md border px-1.5 text-xs leading-5 text-muted-foreground hover:bg-accent" title={t("showQuoted")}>
            •••
          </summary>
          <p className="mt-2 whitespace-pre-wrap break-words border-l-2 pl-3 text-[13px] text-muted-foreground">{quoted}</p>
        </details>
      )}
    </>
  );
}

function Delivery({ m, detail }: { m: Msg; detail: ConversationDetail }) {
  const t = useTranslations("inbox.thread");
  if (m.authorType !== "staff") return null;
  if (m.deliveryError) return <p className="mt-2 text-xs text-destructive">{t(detail.channel === "chat" ? "deliveryErrorChat" : "deliveryError", { error: m.deliveryError })}</p>;
  if (m.emailMessageId) return <p className="mt-2 text-xs text-muted-foreground">{t("emailedTo", { email: m.recipients?.to.join(", ") || detail.contactEmail || "" })}</p>;
  if (detail.channel === "chat") return <p className="mt-1 text-[11px] opacity-70">{t("sentInChat")}</p>;
  return <p className="mt-2 text-xs text-muted-foreground">{t("notSent")}</p>;
}

/** E-mail style: full width, sender and addresses on top. */
function Letter({ m, site, detail }: { m: Msg; site: string; detail: ConversationDetail }) {
  const t = useTranslations("inbox.thread");
  const { relativeTime } = formatters(useLocale());
  const mine = m.authorType === "staff";
  const name = m.authorName ?? (mine ? t("staff") : (detail.contactName ?? t("customer")));
  const address = mine ? null : detail.contactEmail;
  const r = m.recipients;
  return (
    <article className={cn("rounded-xl border shadow-xs", mine ? "bg-primary/[0.03]" : "bg-background")}>
      <header className="flex items-start gap-3 px-4 pt-3">
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold", mine ? "bg-foreground text-background" : "bg-muted")}>{initials(name)}</span>
        <div className="min-w-0 flex-1 text-sm">
          <p className="truncate">
            <span className="font-medium">{name}</span>
            {address && <span className="text-muted-foreground"> &lt;{address}&gt;</span>}
          </p>
          {r && (r.to.length > 0 || r.cc.length > 0) && (
            <p className="truncate text-xs text-muted-foreground">
              {r.to.length > 0 && t("to", { list: r.to.join(", ") })}
              {r.cc.length > 0 && ` · ${t("cc", { list: r.cc.join(", ") })}`}
              {mine && r.bcc && r.bcc.length > 0 && ` · ${t("bcc", { list: r.bcc.join(", ") })}`}
            </p>
          )}
        </div>
        <time className="shrink-0 text-xs text-muted-foreground" dateTime={m.createdAt.toISOString()}>{relativeTime(m.createdAt)}</time>
      </header>
      <div className="px-4 pb-3 pl-[3.75rem] pt-2 text-sm">
        <Body m={m} />
        <MessageFiles site={site} attachments={m.attachments} files={detail.files} />
        <Delivery m={m} detail={detail} />
      </div>
    </article>
  );
}

function Bubble({ m, site, detail }: { m: Msg; site: string; detail: ConversationDetail }) {
  const t = useTranslations("inbox.thread");
  const { relativeTime } = formatters(useLocale());
  const mine = m.authorType === "staff";
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[min(36rem,85%)] rounded-2xl px-3.5 py-2 text-sm", mine ? "rounded-br-md bg-foreground text-background" : "rounded-bl-md border bg-background")}>
        <Body m={m} />
        <MessageFiles site={site} attachments={m.attachments} files={detail.files} />
        <p className={cn("mt-0.5 text-[11px]", mine ? "text-background/60" : "text-muted-foreground")}>
          {mine && `${m.authorName ?? t("staff")} · `}
          {relativeTime(m.createdAt)}
        </p>
        {mine && (m.deliveryError || m.emailMessageId) && <Delivery m={m} detail={detail} />}
      </div>
    </div>
  );
}

function Note({ m, site, detail }: { m: Msg; site: string; detail: ConversationDetail }) {
  const t = useTranslations("inbox.thread");
  const { relativeTime } = formatters(useLocale());
  return (
    <aside className="rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-2.5 text-sm dark:border-amber-800 dark:bg-amber-950/30">
      <p className="mb-1 flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-300">
        <StickyNote className="size-3" />
        <span className="font-medium">{m.authorName ?? t("staff")}</span> · {t("internalNote")} · {relativeTime(m.createdAt)}
      </p>
      <Body m={m} />
      <MessageFiles site={site} attachments={m.attachments} files={detail.files} />
    </aside>
  );
}
