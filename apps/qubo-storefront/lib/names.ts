/**
 * Imported catalogues often shout ("FROID COMMERCIAL") or whisper ("congélateur rapide");
 * show both in sentence case. Mixed-case names are left alone.
 */
export function tidyName(name: string | null | undefined) {
  const t = (name ?? "").trim();
  if (t.length > 3 && t === t.toLocaleUpperCase()) return t[0] + t.slice(1).toLocaleLowerCase();
  const first = t[0] ?? "";
  return first !== first.toLocaleUpperCase() ? first.toLocaleUpperCase() + t.slice(1) : t;
}
