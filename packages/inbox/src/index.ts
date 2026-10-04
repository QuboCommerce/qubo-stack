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
