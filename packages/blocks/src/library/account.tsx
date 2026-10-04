"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

export type AccountOrder = {
  number: string;
  status: string;
  total: string;
  currency: string;
  createdAt: string;
  items: { name: string; variant: string | null; quantity: number }[];
};
export type AccountData = { user: { name: string; email: string }; orders: AccountOrder[]; /** Staff only: sign-in link to the Qubo panel. */ panelUrl?: string };

export type AccountLabels = {
  signInTab: string;
  signUpTab: string;
  name: string;
  email: string;
  password: string;
  signIn: string;
  signUp: string;
  signOut: string;
  openPanel: string;
  greeting: string;
  ordersTitle: string;
  noOrders: string;
  invalidCredentials: string;
  emailTaken: string;
  weakPassword: string;
  error: string;
  statuses: Record<string, string>;
};

type State = { kind: "loading" } | { kind: "guest" } | { kind: "user"; data: AccountData } | { kind: "unavailable" };

const authErrorLabel = (code: string | undefined, labels: AccountLabels) => {
  if (code === "INVALID_EMAIL_OR_PASSWORD") return labels.invalidCredentials;
  if (code?.startsWith("USER_ALREADY_EXISTS")) return labels.emailTaken;
  if (code === "PASSWORD_TOO_SHORT" || code === "PASSWORD_TOO_LONG") return labels.weakPassword;
  return labels.error;
};

/**
 * Customer account on the site's own host: sign in / create account, then
 * profile and orders. Talks to the storefront's same-origin `/api/auth/*` and
 * `/api/account`, so the session cookie never leaves this domain.
 */
/** `preview` (editor): render a fixed state and never touch the network. */
export function AccountView({ labels, locale, preview }: { labels: AccountLabels; locale: string; preview?: AccountData | "guest" }) {
  const [state, setState] = useState<State>(
    preview === "guest" ? { kind: "guest" } : preview ? { kind: "user", data: preview } : { kind: "loading" },
  );
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/account", { cache: "no-store" }).catch(() => null);
    if (!res) return setState({ kind: "unavailable" });
    if (res.status === 401) return setState({ kind: "guest" });
    if (!res.ok) return setState({ kind: "unavailable" });
    setState({ kind: "user", data: (await res.json()) as AccountData });
  }, []);

  useEffect(() => {
    if (!preview) void load();
  }, [load, preview]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (preview) return;
    const form = new FormData(event.currentTarget);
    const body =
      mode === "signIn"
        ? { email: form.get("email"), password: form.get("password") }
        : { name: form.get("name"), email: form.get("email"), password: form.get("password") };
    setBusy(true);
    setError(null);
    const res = await fetch(mode === "signIn" ? "/api/auth/sign-in/email" : "/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (!res?.ok) {
      const payload = (await res?.json().catch(() => null)) as { code?: string } | null;
      setError(authErrorLabel(payload?.code, labels));
      setBusy(false);
      return;
    }
    await load();
    setBusy(false);
  }

  async function signOut() {
    if (preview) return;
    setBusy(true);
    await fetch("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => null);
    setMode("signIn");
    await load();
    setBusy(false);
  }

  if (state.kind === "loading") return <div className="qb-account" aria-busy="true" />;
  if (state.kind === "unavailable") {
    return (
      <p className="qb-account-error" role="alert">
        {labels.error}
      </p>
    );
  }

  if (state.kind === "guest") {
    return (
      <div className="qb-account" data-mode={mode}>
        <div className="qb-account-tabs" role="tablist">
          {(["signIn", "signUp"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
            >
              {m === "signIn" ? labels.signInTab : labels.signUpTab}
            </button>
          ))}
        </div>
        <form className="qb-account-form" onSubmit={submit}>
          {mode === "signUp" ? (
            <div className="qb-field">
              <label htmlFor="qb-account-name">{labels.name}</label>
              <input id="qb-account-name" className="qb-input" name="name" autoComplete="name" required maxLength={100} />
            </div>
          ) : null}
          <div className="qb-field">
            <label htmlFor="qb-account-email">{labels.email}</label>
            <input id="qb-account-email" className="qb-input" name="email" type="email" autoComplete="email" required maxLength={200} />
          </div>
          <div className="qb-field">
            <label htmlFor="qb-account-password">{labels.password}</label>
            <input
              id="qb-account-password"
              className="qb-input"
              name="password"
              type="password"
              autoComplete={mode === "signIn" ? "current-password" : "new-password"}
              required
              minLength={8}
              maxLength={128}
            />
          </div>
          {error ? (
            <p className="qb-account-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="qb-button" data-emphasis="primary" disabled={busy}>
            {mode === "signIn" ? labels.signIn : labels.signUp}
          </button>
        </form>
      </div>
    );
  }

  const { user, orders, panelUrl } = state.data;
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const money = (value: string, currency: string) => {
    try {
      return new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(value));
    } catch {
      return `${value} ${currency}`;
    }
  };

  return (
    <div className="qb-account" data-mode="user">
      <div className="qb-account-head">
        <div>
          <p className="qb-heading qb-font-heading" style={{ fontSize: "var(--qb-step-2)" }}>
            {labels.greeting.replace("{name}", user.name || user.email)}
          </p>
          <p className="qb-muted qb-small">{user.email}</p>
        </div>
        <div className="qb-account-actions">
          {panelUrl && (
            <a className="qb-button" data-emphasis="primary" href={panelUrl}>
              {labels.openPanel}
            </a>
          )}
          <button type="button" className="qb-button" data-emphasis="secondary" onClick={signOut} disabled={busy}>
            {labels.signOut}
          </button>
        </div>
      </div>
      <h2 className="qb-heading qb-font-heading" style={{ fontSize: "var(--qb-step-1)" }}>
        {labels.ordersTitle}
      </h2>
      {orders.length ? (
        <ul className="qb-account-orders">
          {orders.map((o) => (
            <li key={o.number} className="qb-account-order">
              <div className="qb-account-order-head">
                <strong>{o.number}</strong>
                <span className="qb-muted qb-small">{date.format(new Date(o.createdAt))}</span>
                <span className="qb-account-status" data-status={o.status.toLowerCase()}>
                  {labels.statuses[o.status] ?? o.status}
                </span>
                <strong className="qb-account-order-total">{money(o.total, o.currency)}</strong>
              </div>
              <p className="qb-muted qb-small">
                {o.items.map((i) => `${i.quantity} × ${i.variant && i.variant !== "Default" && i.variant !== i.name ? `${i.name} (${i.variant})` : i.name}`).join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="qb-muted">{labels.noOrders}</p>
      )}
    </div>
  );
}
