"use client";

import { useActionState, useEffect } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import type { ConversationAi } from "@qubo/db/schema";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { retriageAction } from "@/app/ai-actions";
import { cn } from "@qubo/shared/utils";

const CATEGORIES = ["order", "quote", "product", "shipping", "returns", "billing", "technical", "feedback", "other"] as const;

const tone: Record<string, string> = {
  negative: "text-destructive",
  urgent: "text-destructive",
  high: "text-amber-700 dark:text-amber-400",
};

/** What the inbox AI made of this thread, plus a manual re-run. */
export function AiCard({ site, conversationId, ai, triage }: { site: string; conversationId: string; ai: ConversationAi | null; triage: boolean }) {
  const t = useTranslations("inbox.ai");
  const [state, action, pending] = useActionState(retriageAction, null);
  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  const category = (v: string) => (CATEGORIES as readonly string[]).includes(v) ? t(`categories.${v as (typeof CATEGORIES)[number]}`) : v;
  const sentiment = (v: string) => (["positive", "neutral", "negative"].includes(v) ? t(`sentiments.${v as "neutral"}`) : v);
  const urgency = (v: string) => (["low", "normal", "high", "urgent"].includes(v) ? t(`urgencies.${v as "low"}`) : v);

  const facts = ai
    ? [
        [t("facts.category"), category(ai.category), ai.category],
        [t("facts.mood"), sentiment(ai.sentiment), ai.sentiment],
        [t("facts.urgency"), urgency(ai.urgency), ai.urgency],
        [t("facts.language"), ai.language?.toUpperCase() ?? null, ""],
        [t("facts.order"), ai.extracted.orderNumber ? `#${ai.extracted.orderNumber.replace(/^#/, "")}` : null, ""],
        [t("facts.phone"), ai.extracted.phone ?? null, ""],
      ].filter((f): f is [string, string, string] => Boolean(f[1]))
    : [];

  return (
    <section className="rounded-lg border bg-gradient-to-b from-violet-500/[0.04] to-transparent p-3">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Sparkles className="size-3.5 text-violet-500" />
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("title")}</h3>
        <form action={action} className="ml-auto">
          <input type="hidden" name="site" value={site} />
          <input type="hidden" name="id" value={conversationId} />
          <button type="submit" disabled={pending} className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50" title={ai ? t("rerun") : t("runNow")} aria-label={ai ? t("rerunLabel") : t("runLabel")}>
            <RefreshCw className={cn("size-3.5", pending && "animate-spin")} />
          </button>
        </form>
      </div>
      {ai ? (
        <>
          <p className="text-[13px] leading-relaxed">{ai.summary}</p>
          {ai.spam && <p className="mt-1.5 text-xs font-medium text-destructive">{t("spam")}</p>}
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            {facts.map(([k, v, raw]) => (
              <div key={k} className="min-w-0">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className={cn("break-words font-medium capitalize", tone[raw])}>{v}</dd>
              </div>
            ))}
          </dl>
          {ai.extracted.products && ai.extracted.products.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{t("mentions", { products: ai.extracted.products.join(", ") })}</p>}
          <p className="mt-2 text-[11px] text-muted-foreground/80">{t("disclaimer", { model: ai.model })}</p>
        </>
      ) : (
        <p className="text-[13px] text-muted-foreground">{triage ? t("triageOn") : t("triageOff")}</p>
      )}
    </section>
  );
}
