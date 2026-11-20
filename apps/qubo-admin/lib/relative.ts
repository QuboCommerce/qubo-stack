/** "just now", "2 minutes ago", "3 hours ago", "4 days ago" in the given locale (client and server). `locale` defaults to the browser's `<html lang>`, else "en"; pass `useLocale()` / `await getLocale()` on the server. */
export function ago(at: string | Date, locale?: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(at).getTime()) / 1000));
  const rtf = new Intl.RelativeTimeFormat(locale ?? (typeof document !== "undefined" ? document.documentElement.lang || "en" : "en"), { numeric: "auto" });
  if (s < 45) return rtf.format(0, "second");
  const m = Math.round(s / 60);
  if (m < 60) return rtf.format(-m, "minute");
  const h = Math.round(m / 60);
  if (h < 24) return rtf.format(-h, "hour");
  return rtf.format(-Math.round(h / 24), "day");
}
