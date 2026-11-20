"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ago } from "@/lib/relative";

type Other = {
  sessionId: string;
  deviceLabel: string;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  isLocal: boolean;
  lastActiveAt: string;
  isFocused: boolean;
};

const flag = (cc: string | null) => (cc && /^[A-Z]{2}$/i.test(cc) ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "");
const place = (o: Other, t: (key: "thisNetwork" | "unknownPlace") => string) => (o.isLocal ? t("thisNetwork") : [o.city && o.region && o.region !== o.city ? `${o.city} (${o.region})` : o.city, o.country].filter(Boolean).join(", ") || t("unknownPlace"));

export function SignInForm({ email }: { email?: string }) {
  const t = useTranslations("auth.signIn");
  const locale = useLocale();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [others, setOthers] = useState<Other[] | null>(null);

  async function takeOver() {
    if (!others) return;
    setPending(true);
    const r = await fetch("/api/sessions/takeover", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ sessionIds: others.map((o) => o.sessionId) }),
    });
    if (!r.ok) {
      setPending(false);
      setError(t("takeoverFailed"));
      return;
    }
    window.location.assign("/");
  }

  async function cancel() {
    setPending(true);
    // Cancel = don't sign in here: drop the session we just created, keep the other one.
    await fetch("/api/auth/sign-out", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => {});
    setOthers(null);
    setPending(false);
  }

  if (others) {
    const [first, ...rest] = others;
    return (
      <div className="space-y-4" role="alertdialog" aria-labelledby="takeover-title">
        <h2 id="takeover-title" className="text-base font-semibold">{t("takeover.title")}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t.rich("takeover.body", {
            device: first!.deviceLabel,
            place: `${flag(first!.countryCode)} ${place(first!, t)}`.trim(),
            ago: ago(first!.lastActiveAt, locale),
            focused: String(first!.isFocused),
            b: (chunks) => <strong className="text-foreground">{chunks}</strong>,
          })}
          {rest.length > 0 && ` ${t("takeover.others", { count: rest.length })}`}
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-col gap-2">
          <button className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" disabled={pending} onClick={takeOver} type="button">
            {t("takeover.confirm", { count: others.length })}
          </button>
          <button className="w-full rounded-md border px-4 py-2 disabled:opacity-50" disabled={pending} onClick={cancel} type="button">
            {t("takeover.cancel")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      action="/api/auth/sign-in-form"
      method="post"
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(undefined);
        const form = new FormData(event.currentTarget);
        const response = await fetch("/api/auth/sign-in/email", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            email: String(form.get("email")),
            password: String(form.get("password")),
            callbackURL: "/",
          }),
        });
        if (!response.ok) {
          setPending(false);
          const payload = (await response.json().catch(() => null)) as
            | { message?: string; error?: { message?: string } }
            | null;
          setError(
            payload?.message ??
              payload?.error?.message ??
              t("failed"),
          );
          return;
        }
        // Always ask, never auto-kick: if another session is open, let the user decide.
        const open = await fetch("/api/sessions", { credentials: "include", cache: "no-store" })
          .then((r) => (r.ok ? (r.json() as Promise<{ others: Other[] }>) : { others: [] }))
          .catch(() => ({ others: [] as Other[] }));
        if (open.others.length) {
          setOthers(open.others);
          setPending(false);
          return;
        }
        window.location.assign("/");
      }}
    >
      <label className="block space-y-1">
        <span className="text-sm font-medium">{t("email")}</span>
        <input className="w-full rounded-md border bg-background px-3 py-2" name="email" required type="email" defaultValue={email} autoFocus={!email} />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">{t("password")}</span>
        <input className="w-full rounded-md border bg-background px-3 py-2" name="password" required type="password" autoFocus={Boolean(email)} />
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" disabled={pending} type="submit">
        {pending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
