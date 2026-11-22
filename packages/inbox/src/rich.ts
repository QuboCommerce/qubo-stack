/**
 * Staff replies are written in a rich editor (Tiptap) and arrive as its JSON
 * document. We render that ourselves, from an allowlist, so the HTML we store
 * and e-mail never contains anything the editor didn't offer.
 */

export type RichMark = { type: string; attrs?: Record<string, unknown> };
export type RichNode = { type: string; text?: string; marks?: RichMark[]; content?: RichNode[]; attrs?: Record<string, unknown> };
export type RichDoc = { type: "doc"; content?: RichNode[] };

const MAX_JSON = 200_000;
const MAX_DEPTH = 12;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Only links a mail client or browser should follow. */
export function safeHref(href: unknown): string | null {
  if (typeof href !== "string") return null;
  const v = href.trim();
  return /^(https?:\/\/|mailto:)/i.test(v) && v.length <= 2000 ? v : null;
}

/** Parses the editor's JSON; null when it isn't a document. */
export function parseDoc(json: string | null | undefined): RichDoc | null {
  if (!json || json.length > MAX_JSON) return null;
  try {
    const v = JSON.parse(json) as unknown;
    return v && typeof v === "object" && (v as RichDoc).type === "doc" ? (v as RichDoc) : null;
  } catch {
    return null;
  }
}

// Inline styles: mail clients ignore stylesheets.
const TAGS: Record<string, [open: string, close: string]> = {
  paragraph: ['<p style="margin:0 0 0.75em">', "</p>"],
  bulletList: ['<ul style="margin:0 0 0.75em;padding-left:1.5em">', "</ul>"],
  orderedList: ['<ol style="margin:0 0 0.75em;padding-left:1.5em">', "</ol>"],
  listItem: ["<li>", "</li>"],
  blockquote: ['<blockquote style="margin:0 0 0.75em;padding-left:0.75em;border-left:3px solid #d4d4d8;color:#52525b">', "</blockquote>"],
};
const MARKS: Record<string, [string, string]> = { bold: ["<strong>", "</strong>"], italic: ["<em>", "</em>"], underline: ["<u>", "</u>"], strike: ["<s>", "</s>"] };

function textHtml(node: RichNode): string {
  let out = esc(node.text ?? "");
  for (const m of node.marks ?? []) {
    if (m.type === "link") {
      const href = safeHref(m.attrs?.href);
      if (href) out = `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${out}</a>`;
    } else if (MARKS[m.type]) out = `${MARKS[m.type]![0]}${out}${MARKS[m.type]![1]}`;
  }
  return out;
}

function nodeHtml(node: RichNode, depth: number): string {
  if (depth > MAX_DEPTH) return "";
  if (node.type === "text") return textHtml(node);
  if (node.type === "hardBreak") return "<br>";
  const inner = (node.content ?? []).map((c) => nodeHtml(c, depth + 1)).join("");
  const tag = TAGS[node.type];
  // Unknown blocks keep their text but lose their markup.
  return tag ? `${tag[0]}${inner}${tag[1]}` : inner;
}

export const docToHtml = (doc: RichDoc) => (doc.content ?? []).map((n) => nodeHtml(n, 0)).join("");

function nodeText(node: RichNode, depth: number, prefix = ""): string {
  if (depth > MAX_DEPTH) return "";
  switch (node.type) {
    case "text":
      return node.text ?? "";
    case "hardBreak":
      return "\n";
    case "bulletList":
    case "orderedList":
      return (node.content ?? []).map((li, i) => `${node.type === "orderedList" ? `${i + 1}.` : "-"} ${nodeText(li, depth + 1).trim()}`).join("\n");
    case "blockquote":
      return (node.content ?? []).map((c) => nodeText(c, depth + 1)).join("\n").split("\n").map((l) => `> ${l}`).join("\n");
    default: {
      const inner = (node.content ?? []).map((c) => nodeText(c, depth + 1)).join(node.type === "listItem" ? "\n" : "");
      return prefix + inner;
    }
  }
}

/** Plain-text twin of the document (e-mail text part, previews, search, AI). */
export const docToText = (doc: RichDoc) =>
  (doc.content ?? [])
    .map((n) => nodeText(n, 0))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
