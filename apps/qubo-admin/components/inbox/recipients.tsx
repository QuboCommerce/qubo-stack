"use client";

import { useState } from "react";
import { Lock, X } from "lucide-react";
import { isEmail, LIMITS } from "@qubo/inbox";
import { useTranslations } from "next-intl";
import { cn } from "@qubo/shared/utils";

type Kind = "cc" | "bcc";

/**
 * Who an e-mail reply goes to. The contact is fixed; Cc and Bcc persist on the
 * thread. Chips only leave through their own x button: backspace in the input
 * never eats one, so nobody drops a Bcc by accident.
 */
export function Recipients({ to, initial }: { to: string; initial: { cc: string[]; bcc: string[] } }) {
  const t = useTranslations("inbox.composer.recipients");
  const [list, setList] = useState(initial);
  const [open, setOpen] = useState<Kind | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState(false);
  const total = list.cc.length + list.bcc.length;

  const add = (kind: Kind) => {
    const parts = draft.split(/[\s,;]+/).map((p) => p.trim().toLowerCase()).filter(Boolean);
    if (!parts.length) return true;
    const bad = parts.filter((p) => !isEmail(p) || p === to.toLowerCase());
    const good = parts.filter((p) => !bad.includes(p) && !list.cc.includes(p) && !list.bcc.includes(p));
    if (good.length) setList((l) => ({ ...l, [kind]: [...l[kind], ...good].slice(0, LIMITS.ccRecipients - (total - l[kind].length)) }));
    setDraft(bad.join(" "));
    setError(bad.length > 0);
    return bad.length === 0;
  };

  const row = (kind: Kind) =>
    (list[kind].length > 0 || open === kind) && (
      <div className="flex min-h-7 flex-wrap items-center gap-1">
        <span className="w-8 shrink-0 text-xs text-muted-foreground">{t(kind)}</span>
        {list[kind].map((e) => (
          <span key={e} className="inline-flex h-6 items-center gap-1 rounded-md border bg-background pl-2 pr-0.5 text-xs">
            {e}
            <button
              type="button"
              onClick={() => setList((l) => ({ ...l, [kind]: l[kind].filter((x) => x !== e) }))}
              className="grid size-5 place-items-center rounded hover:bg-accent"
              aria-label={t("remove", { email: e })}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        {open === kind && total < LIMITS.ccRecipients && (
          <input
            autoFocus
            type="email"
            value={draft}
            placeholder={t("placeholder")}
            aria-label={t("add", { kind: t(kind) })}
            aria-invalid={error}
            onChange={(e) => (setDraft(e.target.value), setError(false))}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
                if (!draft.trim()) return;
                e.preventDefault();
                add(kind);
              }
              if (e.key === "Escape") (setDraft(""), setOpen(null));
            }}
            onBlur={() => add(kind) && !draft.trim() && setOpen(null)}
            className={cn("h-6 min-w-40 flex-1 bg-transparent text-xs outline-none", error && "text-destructive")}
          />
        )}
        {list[kind].map((e) => (
          <input key={e} type="hidden" name={kind} value={e} />
        ))}
      </div>
    );

  return (
    <div className="space-y-0.5 border-b px-3 py-1.5">
      <input type="hidden" name="recipients" value="on" />
      <div className="flex min-h-7 flex-wrap items-center gap-1">
        <span className="w-8 shrink-0 text-xs text-muted-foreground">{t("to")}</span>
        <span className="inline-flex h-6 items-center gap-1 rounded-md bg-muted px-2 text-xs" title={t("toHint")}>
          <Lock className="size-3 text-muted-foreground" /> {to}
        </span>
        <span className="ml-auto flex gap-0.5">
          {(["cc", "bcc"] as const).map(
            (k) =>
              open !== k && (
                <button key={k} type="button" onClick={() => (setOpen(k), setDraft(""), setError(false))} className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
                  {t(k)}
                </button>
              ),
          )}
        </span>
      </div>
      {row("cc")}
      {row("bcc")}
      {error && <p className="pl-9 text-xs text-destructive">{t("invalid")}</p>}
    </div>
  );
}
