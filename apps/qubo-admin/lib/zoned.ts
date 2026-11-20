/** Wall-clock time in `timeZone` for `<input type="datetime-local">` and back. */

export const DEFAULT_ZONE = "Europe/Brussels";

const parts = (date: Date, timeZone: string) => {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date))
    out[p.type] = p.value;
  return out;
};

/** `2026-11-20T10:00` → that wall time in `timeZone` as a Date. Null when empty or invalid. */
export function fromLocalInput(value: string, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const guess = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!);
  // Two passes settle DST edges: the offset is read at the guessed instant, then re-read.
  let at = guess;
  for (let i = 0; i < 2; i++) {
    const p = parts(new Date(at), timeZone);
    const shown = Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!);
    at = at + (guess - shown);
  }
  return new Date(at);
}

export function toLocalInput(date: Date | null | undefined, timeZone: string): string {
  if (!date) return "";
  const p = parts(date, timeZone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
