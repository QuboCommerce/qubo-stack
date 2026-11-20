/**
 * Locale-aware formatting. Every function takes an optional trailing `locale` ("en" | "fr").
 * Omitted: the browser reads `<html lang>` (set from the active admin language); the server
 * cannot read it synchronously and falls back to "en". Server code that must follow the
 * language should call `getFormatters()` from `@/lib/format-server` (or pass `await getLocale()`);
 * client code should pass `useLocale()` or use `formatters(useLocale())`.
 */
import { ago } from "./relative";

export const activeLocale = (locale?: string) =>
  locale ?? (typeof document !== "undefined" ? document.documentElement.lang || "en" : "en");

// Belgian regional variants keep euro-friendly separators and day-first dates.
const intlTag = (locale?: string) => (activeLocale(locale).startsWith("fr") ? "fr-BE" : "en-BE");
const dateTag = (locale?: string) => (activeLocale(locale).startsWith("fr") ? "fr-BE" : "en-GB");

export const money = (value: number | string, currency = "EUR", compact = false, locale?: string) =>
  new Intl.NumberFormat(intlTag(locale), {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(Number(value));

export const number = (value: number, locale?: string) => new Intl.NumberFormat(intlTag(locale)).format(value);

export const shortDate = (d: Date | string, locale?: string) =>
  new Intl.DateTimeFormat(dateTag(locale), { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));

export function relativeTime(d: Date | string, locale?: string) {
  const diff = (new Date(d).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(activeLocale(locale), { numeric: "auto" });
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"], [60, "minute"], [24, "hour"], [7, "day"], [4.345, "week"], [12, "month"], [Infinity, "year"],
  ];
  let value = diff;
  for (const [size, unit] of steps) {
    if (Math.abs(value) < size) return rtf.format(Math.round(value), unit);
    value /= size;
  }
  return shortDate(d, locale);
}

export const supportedLocales = ["fr-BE", "nl-BE", "en", "fr", "nl", "de"] as const;

export const localeLabel: Record<string, string> = {
  "fr-BE": "French (Belgium)",
  "nl-BE": "Dutch (Belgium)",
  en: "English",
  fr: "French",
  nl: "Dutch",
  de: "German",
};

/** Language name in the given UI language, e.g. localeName("fr-BE", "fr") = "français (Belgique)". */
export function localeName(code: string, locale?: string) {
  try {
    return new Intl.DisplayNames([activeLocale(locale)], { type: "language" }).of(code) ?? localeLabel[code] ?? code;
  } catch {
    return localeLabel[code] ?? code;
  }
}

/** Every formatter bound to one locale: `const f = formatters(locale); f.money(12)`. */
export const formatters = (locale?: string) => ({
  money: (value: number | string, currency = "EUR", compact = false) => money(value, currency, compact, locale),
  number: (value: number) => number(value, locale),
  shortDate: (d: Date | string) => shortDate(d, locale),
  relativeTime: (d: Date | string) => relativeTime(d, locale),
  ago: (at: string | Date) => ago(at, locale),
  localeName: (code: string) => localeName(code, locale),
});

/** Legacy product images are served by the storefront; absolute URLs pass through. */
export function assetUrl(url: string | null | undefined) {
  if (!url) return null;
  if (/^https?:\/\//.test(url)) return url;
  // Legacy images and the media library are served by the admin itself, so a relative URL works on any host/IP.
  if (url.startsWith("/api/legacy-assets/") || url.startsWith("/api/media/")) return url;
  return `${process.env.PUBLIC_ASSET_URL ?? process.env.STOREFRONT_URL ?? process.env.NEXT_PUBLIC_MARKETING_URL ?? ""}${url}`;
}
