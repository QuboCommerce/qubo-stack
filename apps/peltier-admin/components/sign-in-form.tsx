"use client";

import { useState } from "react";

export function SignInForm() {
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

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
        setPending(false);
        if (!response.ok) {
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
        window.location.assign("/");
      }}
    >
      <label className="block space-y-1">
        <span className="text-sm font-medium">E-mail</span>
        <input className="w-full rounded-md border bg-background px-3 py-2" name="email" required type="email" />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Mot de passe</span>
        <input className="w-full rounded-md border bg-background px-3 py-2" name="password" required type="password" />
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" disabled={pending} type="submit">
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
