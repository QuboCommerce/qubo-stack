"use client";

import { useEffect } from "react";

const SELECTOR = 'form[action^="/api/forms/"]';

const MESSAGES: Record<string, Record<string, string>> = {
  rate_limited: { en: "Too many messages, please try again in a minute.", fr: "Trop de messages, réessayez dans une minute.", nl: "Te veel berichten, probeer het over een minuut opnieuw." },
  error: { en: "Sending failed, please try again.", fr: "L'envoi a échoué, veuillez réessayer.", nl: "Verzenden mislukt, probeer het opnieuw." },
};
const t = (key: keyof typeof MESSAGES) => MESSAGES[key]![document.documentElement.lang.slice(0, 2)] ?? MESSAGES[key]!.en!;

/**
 * Progressive enhancement for form blocks: posts with fetch and swaps the form
 * for its `data-success` message. Without JS the plain POST + redirect works.
 */
export function FormEnhancer() {
  useEffect(() => {
    const onSubmit = async (e: SubmitEvent) => {
      const form = e.target instanceof HTMLFormElement && e.target.matches(SELECTOR) ? e.target : null;
      if (!form || e.defaultPrevented) return;
      e.preventDefault();
      if (form.dataset.state === "sending") return;
      form.dataset.state = "sending";
      form.querySelector(".qb-form-error")?.remove();
      const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (submit) submit.disabled = true;
      try {
        const res = await fetch(form.action, { method: "POST", body: new FormData(form), headers: { accept: "application/json" } });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) throw new Error(json.error ?? "error");
        const done = document.createElement("p");
        done.className = "qb-form-success";
        done.setAttribute("role", "status");
        done.textContent = form.dataset.success || "✓";
        form.replaceWith(done);
      } catch (err) {
        form.dataset.state = "error";
        const p = document.createElement("p");
        p.className = "qb-form-error qb-small";
        p.setAttribute("role", "alert");
        p.textContent = t(err instanceof Error && err.message === "rate_limited" ? "rate_limited" : "error");
        form.append(p);
        if (submit) submit.disabled = false;
      }
    };
    document.addEventListener("submit", onSubmit);
    return () => document.removeEventListener("submit", onSubmit);
  }, []);
  return null;
}
