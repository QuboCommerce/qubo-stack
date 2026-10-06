/**
 * Locale prefixes on storefront URLs. The primary language lives at the root
 * (`/livraison`), every other published language under its two-letter code
 * (`/nl/levering`). Only the language part of a locale appears in the URL:
 * `nl-BE` and `nl-NL` would both be `/nl`, so a site enables one per language.
 */

/** `nl-BE` → `nl`. */
export const languageOf = (locale: string) => locale.toLowerCase().split(/[-_]/)[0] ?? locale.toLowerCase();

/** `/nl` for a secondary language, `""` for the primary one. */
export function localePrefix(locale: string, primary: string): string {
  return languageOf(locale) === languageOf(primary) ? "" : `/${languageOf(locale)}`;
}

/** Puts a root-relative path under its locale prefix: `/levering` → `/nl/levering`. Absolute URLs pass through. */
export function localizePath(path: string, locale: string, primary: string): string {
  const prefix = localePrefix(locale, primary);
  if (!prefix || !path.startsWith("/") || path.startsWith("//")) return path;
  return path === "/" ? prefix : `${prefix}${path}`;
}

const LANG_SEGMENT = /^\/([a-z]{2})(?=\/|$)/;

/** Splits a leading two-letter segment off a path: `/nl/levering?x=1` → `{ lang: "nl", path: "/levering?x=1" }`. */
export function splitLocalePath(path: string): { lang: string | null; path: string } {
  const m = LANG_SEGMENT.exec(path);
  if (!m) return { lang: null, path };
  const rest = path.slice(m[0].length);
  return { lang: m[1]!, path: rest === "" || rest.startsWith("?") ? `/${rest}` : rest };
}

/** Human label for a language switch: `nl-BE` → `NL`. */
export const languageLabel = (locale: string) => languageOf(locale).toUpperCase();
