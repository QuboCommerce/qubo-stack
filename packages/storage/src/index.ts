/** Pure storage rules: what may be uploaded, how it's named. No I/O here. */

export type FileKind = "image" | "video" | "document";
type TypeRule = { mime: string; kind: FileKind; sniff: (b: Uint8Array) => boolean };

const ascii = (b: Uint8Array, at: number, s: string) => [...s].every((c, i) => b[at + i] === c.charCodeAt(0));
const textLike = (b: Uint8Array) => !b.subarray(0, 4096).includes(0);
const isSvg = (b: Uint8Array) => {
  const head = new TextDecoder().decode(b.subarray(0, 2048)).replace(/^\uFEFF/, "").trimStart().toLowerCase();
  return (head.startsWith("<svg") || head.startsWith("<?xml") || head.startsWith("<!--")) && head.includes("<svg");
};
const isZip = (b: Uint8Array) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;

/** Extension → rule. Content is sniffed, so a renamed file can't pass as another type. */
export const FILE_TYPES: Record<string, TypeRule> = {
  jpg: { mime: "image/jpeg", kind: "image", sniff: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  png: { mime: "image/png", kind: "image", sniff: (b) => b[0] === 0x89 && ascii(b, 1, "PNG") },
  gif: { mime: "image/gif", kind: "image", sniff: (b) => ascii(b, 0, "GIF8") },
  webp: { mime: "image/webp", kind: "image", sniff: (b) => ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP") },
  avif: { mime: "image/avif", kind: "image", sniff: (b) => ascii(b, 4, "ftypavi") },
  svg: { mime: "image/svg+xml", kind: "image", sniff: isSvg },
  mp4: { mime: "video/mp4", kind: "video", sniff: (b) => ascii(b, 4, "ftyp") },
  webm: { mime: "video/webm", kind: "video", sniff: (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 },
  pdf: { mime: "application/pdf", kind: "document", sniff: (b) => ascii(b, 0, "%PDF") },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", kind: "document", sniff: isZip },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", kind: "document", sniff: isZip },
  txt: { mime: "text/plain; charset=utf-8", kind: "document", sniff: textLike },
  csv: { mime: "text/csv; charset=utf-8", kind: "document", sniff: textLike },
};
const ALIASES: Record<string, string> = { jpeg: "jpg", jpe: "jpg" };

/** Where a file is going decides what it may be. */
export const UPLOAD_PROFILES = {
  /** Site media library: images and short videos, public. */
  media: { types: ["jpg", "png", "gif", "webp", "avif", "svg", "mp4", "webm", "pdf"], maxBytes: { image: 20e6, video: 100e6, document: 20e6 } },
  /** Files a visitor sends in chat: small, private, temporary. */
  chat: { types: ["jpg", "png", "gif", "webp", "pdf"], maxBytes: { image: 10e6, video: 0, document: 10e6 } },
  /** Files that arrive with e-mail or a form: private. */
  inbox: { types: ["jpg", "png", "gif", "webp", "avif", "pdf", "docx", "xlsx", "txt", "csv", "mp4"], maxBytes: { image: 20e6, video: 40e6, document: 20e6 } },
} as const satisfies Record<string, { types: string[]; maxBytes: Record<FileKind, number> }>;
export type UploadProfile = keyof typeof UPLOAD_PROFILES;

export const CHAT_ATTACHMENTS = {
  /** Files per chat message. */
  perMessage: 3,
  /** Visitor uploads are deleted after this unless staff keep them. */
  ttlMs: 30 * 86_400_000,
} as const;

export const extOf = (filename: string) => {
  const ext = filename.toLowerCase().match(/\.([a-z0-9]{1,5})$/)?.[1] ?? "";
  return ALIASES[ext] ?? ext;
};

export type CheckedFile = { ext: string; mime: string; kind: FileKind };
export type FileProblem = "type" | "content" | "size" | "empty";

/** Validates name + bytes against a profile. */
export function checkFile(profile: UploadProfile, filename: string, bytes: Uint8Array): { ok: true; file: CheckedFile } | { ok: false; problem: FileProblem } {
  const p = UPLOAD_PROFILES[profile];
  const ext = extOf(filename);
  const rule = FILE_TYPES[ext];
  if (!rule || !(p.types as readonly string[]).includes(ext)) return { ok: false, problem: "type" };
  if (!bytes.byteLength) return { ok: false, problem: "empty" };
  if (bytes.byteLength > p.maxBytes[rule.kind]) return { ok: false, problem: "size" };
  if (!rule.sniff(bytes)) return { ok: false, problem: "content" };
  return { ok: true, file: { ext, mime: rule.mime, kind: rule.kind } };
}

export const problemMessage = (problem: FileProblem, filename: string, profile: UploadProfile) =>
  ({
    type: `${filename}: this file type isn't supported here (${UPLOAD_PROFILES[profile].types.join(", ")}).`,
    content: `${filename}: the file doesn't match its extension.`,
    size: `${filename}: too large (max ${Math.round(Math.max(...Object.values(UPLOAD_PROFILES[profile].maxBytes)) / 1e6)} MB).`,
    empty: `${filename}: the file is empty.`,
  })[problem];

/** Keeps a readable, safe filename for display and downloads. */
export function cleanFilename(name: string): string {
  const base = name.replace(/^.*[\\/]/, "").normalize("NFC").replace(/[\u0000-\u001f\u007f"<>|:*?\\/]+/g, "").replace(/\s+/g, " ").trim();
  return (base || "file").slice(-120);
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** Library files: `media/<orgId>/<assetId>.<ext>`, served publicly at `/api/media/<orgId>/<assetId>.<ext>`. */
export const mediaKey = (orgId: string, assetId: string, ext: string) => `media/${orgId}/${assetId}.${ext}`;
export const mediaUrl = (orgId: string, assetId: string, ext: string) => `/api/media/${orgId}/${assetId}.${ext}`;
const MEDIA_PATH = new RegExp(`^(${UUID})/(${UUID})\\.([a-z0-9]{2,5})$`);
/** `/api/media/…` path segments → storage key, or null for anything that isn't a library file. */
export function mediaKeyFromPath(path: string): { key: string; ext: string; assetId: string } | null {
  const m = path.toLowerCase().match(MEDIA_PATH);
  if (!m || !FILE_TYPES[m[3]!]) return null;
  return { key: `media/${m[1]}/${m[2]}.${m[3]}`, ext: m[3]!, assetId: m[2]! };
}

/** Private inbox files: never public, read through a signed short-lived URL. */
export const inboxKey = (siteId: string, conversationId: string, fileId: string, ext: string) => `inbox/${siteId}/${conversationId}/${fileId}.${ext}`;

/** Headers every served file gets; SVG and documents can't run scripts in our origin. */
export function serveHeaders(mime: string, size: number, opts: { immutable: boolean; download?: string }): Record<string, string> {
  const h: Record<string, string> = {
    "content-type": mime,
    "content-length": String(size),
    "cache-control": opts.immutable ? "public, max-age=31536000, immutable" : "private, max-age=300",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; media-src 'self'; sandbox",
  };
  if (opts.download) h["content-disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(opts.download)}`;
  return h;
}

export const formatBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 ** 2).toFixed(1)} MB`;
