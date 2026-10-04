/** Pure inbox rules shared by the API, the admin and tests. No I/O here. */

export const CHANNELS = ["chat", "email", "form", "portal", "system"] as const;
export const STATUSES = ["open", "pending", "resolved", "snoozed"] as const;
export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type Channel = (typeof CHANNELS)[number];
export type Status = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];

export const LIMITS = {
  fields: 30,
  keyLength: 64,
  valueLength: 5000,
  subjectLength: 160,
  replyLength: 20000,
  /** Forms a site may accumulate by posting unknown keys. */
  formsPerSite: 25,
  /** Public submissions per IP and site, per window. */
  submissionsPerWindow: 5,
  /** All visitors of one site together, per window. */
  submissionsPerSiteWindow: 60,
  windowMs: 60_000,
  /** One chat message from a visitor. */
  chatMessageLength: 4000,
  /** Chat messages per visitor per window (also caps new chats per IP). */
  chatPerWindow: 20,
  /** All chat traffic of one site per window. */
  chatPerSiteWindow: 300,
  /** Messages a visitor sees when the chat opens. */
  chatHistory: 200,
} as const;

/** Snooze choices in the thread header: label → duration. */
export const SNOOZE_OPTIONS = { "1h": ["1 hour", 3_600_000], "4h": ["4 hours", 4 * 3_600_000], "1d": ["Tomorrow", 86_400_000], "3d": ["3 days", 3 * 86_400_000], "7d": ["Next week", 7 * 86_400_000] } as const;
export type SnoozeOption = keyof typeof SNOOZE_OPTIONS;

/** How long a customer may wait for an answer before the list warns, then flags it. */
export const SLA = { warnMs: 4 * 3_600_000, breachMs: 24 * 3_600_000 } as const;

/** `null` when nobody is waiting on us (staff spoke last, or the thread isn't open). */
export function slaState(status: Status, lastFrom: string, lastMessageAt: Date, now = Date.now()): { waitingMs: number; level: "ok" | "warn" | "breach" } | null {
  if (status !== "open" || lastFrom !== "customer") return null;
  const waitingMs = Math.max(0, now - lastMessageAt.getTime());
  return { waitingMs, level: waitingMs >= SLA.breachMs ? "breach" : waitingMs >= SLA.warnMs ? "warn" : "ok" };
}

/** A visitor counts as "in the chat" this long after their last sign of life; after that replies are e-mailed. */
export const CHAT_AWAY_MS = 90_000;

/** Subject of a new chat: its first line, trimmed. */
export function chatSubject(body: string): string {
  const line = body.trim().split(/\r?\n/, 1)[0]!.replace(/\s+/g, " ");
  return line.length > 80 ? `${line.slice(0, 79)}…` : line || "Chat";
}

/** Staff appear to visitors by first name only. */
export const publicStaffName = (name: string | null) => name?.trim().split(/\s+/)[0] || null;

/** Hidden field the form blocks render; humans leave it empty. */
export const HONEYPOT = "_company_website";

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
export const isEmail = (v: string) => EMAIL.test(v);

export type FormData = Record<string, string>;

/** Trims, drops internal (`_`-prefixed) and empty fields, enforces size limits. */
export function cleanFormData(raw: Record<string, unknown>): FormData {
  const out: FormData = {};
  for (const [k, v] of Object.entries(raw)) {
    if (Object.keys(out).length >= LIMITS.fields) break;
    const key = k.trim().slice(0, LIMITS.keyLength);
    if (!key || key.startsWith("_") || typeof v !== "string") continue;
    const value = v.trim().slice(0, LIMITS.valueLength);
    if (value) out[key] = value;
  }
  return out;
}

const NAME_KEYS = /^(name|full_?name|your_?name|naam|nom|nom_complet)$/i;
const FIRST_KEYS = /^(first_?name|firstname|voornaam|prenom|prénom)$/i;
const LAST_KEYS = /^(last_?name|lastname|surname|achternaam|nom_de_famille)$/i;
const EMAIL_KEYS = /e-?mail|courriel/i;
const SUBJECT_KEYS = /^(subject|onderwerp|sujet|objet)$/i;
const BODY_KEYS = /^(message|msg|body|comments?|details|bericht|vraag|question)$/i;

const find = (data: FormData, re: RegExp) => Object.keys(data).find((k) => re.test(k));
const humanise = (key: string) => key.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export type FormThread = {
  contactName: string | null;
  contactEmail: string | null;
  subject: string;
  body: string;
};

/**
 * Turns a form submission into a conversation opener. Field names are free-form
 * (builders choose them), so contact details are recognised by common names in
 * EN/NL/FR; everything else is listed in the message body.
 */
export function formThread(formName: string, data: FormData): FormThread {
  const emailKey = find(data, EMAIL_KEYS);
  const contactEmail = emailKey && isEmail(data[emailKey]!) ? data[emailKey]!.toLowerCase() : null;
  const nameKey = find(data, NAME_KEYS);
  const first = find(data, FIRST_KEYS);
  const last = find(data, LAST_KEYS);
  const contactName = (nameKey ? data[nameKey] : [first && data[first], last && data[last]].filter(Boolean).join(" ")) || null;
  const subjectKey = find(data, SUBJECT_KEYS);
  const bodyKey = find(data, BODY_KEYS);

  const used = new Set([contactEmail ? emailKey : null, nameKey, first, last, subjectKey, bodyKey].filter(Boolean));
  const extra = Object.entries(data).filter(([k]) => !used.has(k));
  const body = [bodyKey ? data[bodyKey] : null, extra.length ? extra.map(([k, v]) => `${humanise(k)}: ${v}`).join("\n") : null]
    .filter(Boolean)
    .join("\n\n");

  const who = contactName ?? contactEmail ?? "Anonymous";
  const subject = (subjectKey ? data[subjectKey]! : `${formName} · ${who}`).slice(0, LIMITS.subjectLength);
  return { contactName, contactEmail, subject, body: body || "(no message)" };
}

/** A sign-up form (e-mail only) is a subscriber, not a conversation. */
export const isSignupOnly = (data: FormData) => {
  const keys = Object.keys(data);
  return keys.length === 1 && EMAIL_KEYS.test(keys[0]!);
};

export const formNameFromKey = (key: string) => humanise(key);

/** Fixed-window limiter, per process. Good enough for a single API instance. */
export function createRateLimiter(limit: number = LIMITS.submissionsPerWindow, windowMs: number = LIMITS.windowMs) {
  const hits = new Map<string, { n: number; reset: number }>();
  return (key: string, now = Date.now()) => {
    const h = hits.get(key);
    if (!h || h.reset <= now) {
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
      hits.set(key, { n: 1, reset: now + windowMs });
      return true;
    }
    return ++h.n <= limit;
  };
}

const escapeHtml = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]!);

/** Plain text → minimal safe HTML for outbound e-mail. */
export const textToHtml = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

export const replySubject = (subject: string) => (/^re:/i.test(subject) ? subject : `Re: ${subject}`);

// ----------------------------------------------------------- inbound e-mail ---

/** Inbound e-mail per sender per site, per hour; a mail loop or a flood stops here. */
export const INBOUND_PER_HOUR = 30;

/** `"Name" <a@b.c>` → `{ name, email }` (lower-cased address). */
export function parseAddress(value: string): { name: string | null; email: string } | null {
  const angle = value.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  const email = (angle ? angle[2]! : value).trim().toLowerCase();
  if (!isEmail(email)) return null;
  return { name: angle?.[1]?.trim() || null, email };
}

export type InboundRoute = { conversationId: string } | { siteSlug: string } | null;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const REPLY_LOCAL = new RegExp(`^reply\\+(${UUID})$`, "i");

/**
 * Where an inbound e-mail goes, from the addresses it was sent to on our
 * inbound domain: `reply+<conversationId>@` continues a thread, `<site-slug>@`
 * reaches a site's inbox. Reply addresses win over site addresses.
 */
export function inboundRoute(addresses: string[], inboundDomain: string): InboundRoute {
  const domain = inboundDomain.trim().toLowerCase();
  if (!domain) return null;
  let siteSlug: string | null = null;
  for (const raw of addresses) {
    const email = parseAddress(raw)?.email;
    if (!email || !email.endsWith(`@${domain}`)) continue;
    const local = email.slice(0, -domain.length - 1);
    const reply = local.match(REPLY_LOCAL);
    if (reply) return { conversationId: reply[1]!.toLowerCase() };
    siteSlug ??= local.replace(/\+.*$/, "");
  }
  return siteSlug ? { siteSlug } : null;
}

export const replyAddress = (conversationId: string, inboundDomain: string) => `reply+${conversationId}@${inboundDomain.trim().toLowerCase()}`;
export const siteInboundAddress = (slug: string, inboundDomain: string) => `${slug}@${inboundDomain.trim().toLowerCase()}`;

type Headers = Record<string, string | string[] | undefined>;
const header = (headers: Headers, name: string) => {
  const v = Object.entries(headers).find(([k]) => k.toLowerCase() === name)?.[1];
  return Array.isArray(v) ? v.join(" ") : (v ?? "");
};

/** Message-IDs this e-mail answers (In-Reply-To first, then References newest-first). */
export function referencedIds(headers: Headers): string[] {
  const ids = [...header(headers, "in-reply-to").matchAll(/<[^<>\s]+>/g), ...[...header(headers, "references").matchAll(/<[^<>\s]+>/g)].reverse()].map((m) => m[0]);
  return [...new Set(ids)].slice(0, 20);
}

/** Out-of-office, bounces and list mail never open or reopen a conversation. */
export function isAutoReply(headers: Headers, from: string): boolean {
  const auto = header(headers, "auto-submitted").toLowerCase();
  if (auto && auto !== "no") return true;
  if (/^(bulk|junk|list|auto_reply)$/i.test(header(headers, "precedence").trim())) return true;
  if (header(headers, "x-autoreply") || header(headers, "x-autorespond") || header(headers, "list-id")) return true;
  return /^(mailer-daemon|postmaster|no-?reply)@/i.test(parseAddress(from)?.email ?? "");
}

/** Readable text from an HTML-only e-mail; not a sanitiser, the result is stored as plain text. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const QUOTE_HEADER = [
  /^On .{4,200} wrote:\s*$/i,
  /^Op .{4,200} (schreef|heeft .{1,80} geschreven).*:\s*$/i,
  /^Le .{4,200} a écrit\s*:\s*$/i,
  /^Am .{4,200} schrieb .*:\s*$/i,
  /^-{2,}\s*(Original Message|Oorspronkelijk bericht|Message d'origine|Forwarded message)\s*-{2,}/i,
  /^_{10,}\s*$/,
  /^(From|Van|De|Von):\s.+$/,
];

/**
 * The new part of a reply: everything above the quoted history. Falls back to
 * the whole text when stripping would leave nothing.
 */
export function stripQuoted(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    // Gmail wraps long "On … wrote:" headers over two lines.
    const joined = i + 1 < lines.length ? `${line} ${lines[i + 1]!.trim()}` : line;
    if (QUOTE_HEADER.some((re) => re.test(line) || re.test(joined))) {
      end = i;
      break;
    }
    if (line.startsWith(">") && lines.slice(i).every((l) => !l.trim() || l.trim().startsWith(">"))) {
      end = i;
      break;
    }
  }
  const kept = lines.slice(0, end).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return kept || text.trim();
}

/** Subject without reply/forward prefixes, for matching a thread whose headers got lost. */
export const baseSubject = (subject: string) =>
  subject
    .replace(/^\s*((re|fw|fwd|tr|aw|wg|antw|réf)\s*(\[\d+\])?\s*:\s*)+/i, "")
    .trim()
    .toLowerCase();
