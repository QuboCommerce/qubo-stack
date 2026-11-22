import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Building2, Mail, MapPin, Phone, Search, UserRound } from "lucide-react";
import { AiCard } from "@/components/inbox/ai-card";
import { channelIcon, statusDot } from "@/components/inbox/icons";
import { CopyButton, TagsEditor } from "@/components/inbox/message-actions";
import { cn } from "@qubo/shared/utils";
import { formatters } from "@/lib/format";
import type { ConversationDetail } from "@/lib/inbox";

export type InboxAi = { triage: boolean; drafts: boolean } | null;

const sectionTitle = "mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground";

const initials = (name: string) =>
  name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

/** Who wrote in and everything known about the thread: the right column (xl) or the Info sheet. */
export function ContextPanel({ detail, site, ai, members }: { detail: ConversationDetail; site: string; ai: InboxAi; members: { id: string; name: string }[] }) {
  const t = useTranslations("inbox");
  const { money, relativeTime, shortDate } = formatters(useLocale());
  const data = (detail.submission?.data ?? {}) as Record<string, string>;
  const name = detail.contactName ?? data.name ?? t("list.anonymous");
  const phone = data.phone;
  const company = data.company;
  const address = data.address;
  const copied = [...detail.participants.cc, ...detail.participants.bcc.map((a) => `${a} (${t("composer.recipients.bcc")})`)];
  const Icon = channelIcon[detail.channel];
  const assignee = members.find((m) => m.id === detail.assigneeId)?.name;
  const tags = detail.tags.filter((x) => !x.startsWith("ai:"));
  const row = "group/row flex min-h-7 items-center gap-2 text-[13px]";
  const copyCls = "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/row:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100";
  return (
    <div className="space-y-5 p-4 text-sm">
      {ai && <AiCard site={site} conversationId={detail.id} ai={detail.ai} triage={ai.triage} />}

      <section>
        <div className="mb-2 flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">{initials(name) || <UserRound className="size-4" />}</span>
          <div className="min-w-0">
            <p className="truncate font-medium">{name}</p>
            {detail.customer ? (
              <p className="text-xs text-muted-foreground">{t("context.customerSince", { date: shortDate(detail.customer.createdAt) })}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{t("context.notCustomer")}</p>
            )}
          </div>
        </div>
        <ul className="space-y-0.5">
          {detail.contactEmail && (
            <li className={row}>
              <Mail className="size-3.5 shrink-0 text-muted-foreground" />
              <a href={`mailto:${detail.contactEmail}`} className="min-w-0 flex-1 truncate hover:underline">
                {detail.contactEmail}
              </a>
              <CopyButton text={detail.contactEmail} label={t("menu.copyEmail")} className={copyCls} />
            </li>
          )}
          {phone && (
            <li className={row}>
              <Phone className="size-3.5 shrink-0 text-muted-foreground" />
              <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="min-w-0 flex-1 truncate hover:underline">
                {phone}
              </a>
              <CopyButton text={phone} label={t("menu.copyPhone")} className={copyCls} />
            </li>
          )}
          {company && (
            <li className={row}>
              <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{company}</span>
              <CopyButton text={company} label={t("context.copyCompany")} className={copyCls} />
            </li>
          )}
          {address && (
            <li className={cn(row, "items-start")}>
              <MapPin className="mt-1.5 size-3.5 shrink-0 text-muted-foreground" />
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 whitespace-pre-line py-1 hover:underline">
                {address}
              </a>
              <CopyButton text={address} label={t("context.copyAddress")} className={copyCls} />
            </li>
          )}
        </ul>
        {detail.contactEmail && (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <Link href={`/${site}/inbox?view=all&q=${encodeURIComponent(detail.contactEmail)}`} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline">
              <Search className="size-3" /> {t("menu.fromContact")}
            </Link>
            {detail.customer && (
              <Link href={`/${site}/customers?q=${encodeURIComponent(detail.contactEmail)}`} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline">
                <UserRound className="size-3" /> {t("context.openCustomer")}
              </Link>
            )}
          </div>
        )}
      </section>

      <section>
        <h3 className={sectionTitle}>{t("context.details")}</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
          <dt className="text-muted-foreground">{t("controls.status")}</dt>
          <dd className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", statusDot[detail.status])} /> {t(`statuses.${detail.status as "open"}`)}
          </dd>
          <dt className="text-muted-foreground">{t("context.origin")}</dt>
          <dd className="flex items-center gap-1.5">
            <Icon className="size-3.5 text-muted-foreground" /> {detail.submission?.formName ?? t(`origins.${detail.channel}`)}
          </dd>
          {detail.ticketNumber !== null && (
            <>
              <dt className="text-muted-foreground">{t("context.ticket")}</dt>
              <dd className="tabular-nums">#{detail.ticketNumber}</dd>
            </>
          )}
          <dt className="text-muted-foreground">{t("controls.assignee")}</dt>
          <dd className="truncate">{assignee ?? t("controls.unassigned")}</dd>
          <dt className="text-muted-foreground">{t("context.created")}</dt>
          <dd>{shortDate(detail.createdAt)}</dd>
          <dt className="text-muted-foreground">{t("context.lastMessage")}</dt>
          <dd suppressHydrationWarning>{relativeTime(detail.lastMessageAt)}</dd>
          {detail.submission?.pagePath && (
            <>
              <dt className="text-muted-foreground">{t("context.page")}</dt>
              <dd className="truncate font-mono text-xs leading-5">{detail.submission.pagePath}</dd>
            </>
          )}
          {detail.submission?.locale && (
            <>
              <dt className="text-muted-foreground">{t("context.language")}</dt>
              <dd className="uppercase">{detail.submission.locale}</dd>
            </>
          )}
        </dl>
      </section>

      <section>
        <h3 className={sectionTitle}>{t("tags.title")}</h3>
        <TagsEditor key={tags.join(",")} site={site} conversationId={detail.id} tags={tags} />
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
                <Link href={`/${site}/inbox?view=all&c=${h.id}`} className="block truncate text-[13px] hover:underline">
                  {h.subject}
                </Link>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn("size-1.5 rounded-full", statusDot[h.status])} />
                  {t(`statuses.${h.status as "open"}`)} · <span suppressHydrationWarning>{relativeTime(h.lastMessageAt)}</span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
