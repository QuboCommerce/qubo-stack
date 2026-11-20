export const locales = ["en", "fr"] as const;
export type AdminLocale = (typeof locales)[number];
/** English is the source language: keys are written in `messages/en.json` first. */
export const defaultLocale: AdminLocale = "en";
export const LOCALE_COOKIE = "qubo-lang";

export const localeNames: Record<AdminLocale, string> = { en: "English", fr: "Français" };

export const isLocale = (v: unknown): v is AdminLocale => typeof v === "string" && (locales as readonly string[]).includes(v);

/** First supported language in an Accept-Language header, else the default. */
export function fromAcceptLanguage(header: string | null): AdminLocale {
  for (const part of (header ?? "").split(",")) {
    const tag = part.split(";")[0]!.trim().toLowerCase().split("-")[0];
    if (isLocale(tag)) return tag;
  }
  return defaultLocale;
}
