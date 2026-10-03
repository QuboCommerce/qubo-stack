"use client";

import { useState } from "react";
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
const place = (o: Other) => (o.isLocal ? "this network" : [o.city && o.region && o.region !== o.city ? `${o.city} (${o.region})` : o.city, o.country].filter(Boolean).join(", ") || "an unknown location");

export function SignInForm({ email }: { email?: string }) {
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
      setError("Couldn't sign out the other device. Try again.");
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
        <h2 id="takeover-title" className="text-base font-semibold">Already signed in elsewhere</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Your account currently has another session open on <strong className="text-foreground">{first!.deviceLabel}</strong> from{" "}
          <strong className="text-foreground">{flag(first!.countryCode)} {place(first!)}</strong>. Last active{" "}
          <strong className="text-foreground">{ago(first!.lastActiveAt)}</strong>
          {first!.isFocused ? ", tab in focus" : ""}.
          {rest.length > 0 && ` And ${rest.length} other device${rest.length === 1 ? "" : "s"}.`}
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-col gap-2">
          <button className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" disabled={pending} onClick={takeOver} type="button">
            Sign out {others.length === 1 ? "that device" : "those devices"} and continue
          </button>
          <button className="w-full rounded-md border px-4 py-2 disabled:opacity-50" disabled={pending} onClick={cancel} type="button">
            Cancel
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
              "Connexion impossible.",
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
        <span className="text-sm font-medium">E-mail</span>
        <input className="w-full rounded-md border bg-background px-3 py-2" name="email" required type="email" defaultValue={email} autoFocus={!email} />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Mot de passe</span>
        <input className="w-full rounded-md border bg-background px-3 py-2" name="password" required type="password" autoFocus={Boolean(email)} />
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" disabled={pending} type="submit">
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
