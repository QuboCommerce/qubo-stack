export const money = (value: number | string, currency = "EUR", compact = false) =>
  new Intl.NumberFormat("en-BE", {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(Number(value));

export const number = (value: number) => new Intl.NumberFormat("en-BE").format(value);

export const shortDate = (d: Date | string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));

export function relativeTime(d: Date | string) {
  const diff = (new Date(d).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"], [60, "minute"], [24, "hour"], [7, "day"], [4.345, "week"], [12, "month"], [Infinity, "year"],
  ];
  let value = diff;
  for (const [size, unit] of steps) {
    if (Math.abs(value) < size) return rtf.format(Math.round(value), unit);
    value /= size;
  }
  return shortDate(d);
}

export const localeLabel: Record<string, string> = {
  "fr-BE": "French (Belgium)",
  "nl-BE": "Dutch (Belgium)",
  en: "English",
  fr: "French",
  nl: "Dutch",
};

/** Legacy product images are served by the storefront; absolute URLs pass through. */
export function assetUrl(url: string | null | undefined) {
  if (!url) return null;
  if (/^https?:\/\//.test(url)) return url;
  return `${process.env.STOREFRONT_URL ?? process.env.NEXT_PUBLIC_MARKETING_URL ?? ""}${url}`;
}
