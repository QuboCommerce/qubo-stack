import { createHmac, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { AwsClient } from "aws4fetch";
import { imageSize } from "image-size";

export * from "./index";
import { FILE_TYPES, mediaKeyFromPath, serveHeaders } from "./index";

export type StoredFile = { body: ReadableStream<Uint8Array>; size: number };

export interface StorageDriver {
  readonly name: "disk" | "s3";
  put(key: string, bytes: Uint8Array, mime: string): Promise<void>;
  get(key: string): Promise<StoredFile | null>;
  delete(key: string): Promise<void>;
}

export class StorageNotConfigured extends Error {
  constructor() {
    super("File storage isn't configured: set STORAGE_DIR (local disk) or STORAGE_ENDPOINT + STORAGE_BUCKET (S3).");
  }
}

const safeKey = (key: string) => {
  if (!/^[a-z0-9][a-z0-9/._-]*$/i.test(key) || key.split("/").some((p) => p === ".." || p === "." || !p)) throw new Error(`Invalid storage key: ${key}`);
  return key;
};

/** One directory on the server, e.g. a Docker volume. The default for self-hosting. */
function diskDriver(root: string): StorageDriver {
  const base = resolve(root);
  const path = (key: string) => {
    const p = resolve(join(base, safeKey(key)));
    if (!p.startsWith(base + sep)) throw new Error("Invalid storage key");
    return p;
  };
  return {
    name: "disk",
    async put(key, bytes) {
      const p = path(key);
      await mkdir(dirname(p), { recursive: true });
      const tmp = `${p}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(tmp, bytes);
      await rename(tmp, p);
    },
    async get(key) {
      const p = path(key);
      const s = await stat(p).catch(() => null);
      if (!s?.isFile()) return null;
      return { body: Readable.toWeb(createReadStream(p)) as unknown as ReadableStream<Uint8Array>, size: s.size };
    },
    async delete(key) {
      await rm(path(key), { force: true });
    },
  };
}

/** Any S3-compatible bucket (R2, OVH, Hetzner, Garage, MinIO…), path-style URLs. */
function s3Driver(endpoint: string, bucket: string, accessKeyId: string, secretAccessKey: string, region: string): StorageDriver {
  const aws = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region });
  const url = (key: string) => `${endpoint.replace(/\/+$/, "")}/${encodeURIComponent(bucket)}/${safeKey(key).split("/").map(encodeURIComponent).join("/")}`;
  return {
    name: "s3",
    async put(key, bytes, mime) {
      const res = await aws.fetch(url(key), { method: "PUT", body: bytes as unknown as ArrayBuffer, headers: { "content-type": mime } });
      if (!res.ok) throw new Error(`Storage PUT ${res.status}: ${(await res.text()).slice(0, 200)}`);
    },
    async get(key) {
      const res = await aws.fetch(url(key));
      if (res.status === 404) return null;
      if (!res.ok || !res.body) throw new Error(`Storage GET ${res.status}`);
      return { body: res.body, size: Number(res.headers.get("content-length") ?? 0) };
    },
    async delete(key) {
      const res = await aws.fetch(url(key), { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error(`Storage DELETE ${res.status}`);
    },
  };
}

let cached: StorageDriver | null = null;

/** The instance's storage, from env. S3 when STORAGE_ENDPOINT is set, otherwise STORAGE_DIR on disk. */
export function storage(): StorageDriver {
  if (cached) return cached;
  const env = (k: string) => process.env[k]?.trim() ?? "";
  if (env("STORAGE_ENDPOINT")) {
    if (!env("STORAGE_BUCKET") || !env("STORAGE_ACCESS_KEY") || !env("STORAGE_SECRET_KEY")) throw new StorageNotConfigured();
    cached = s3Driver(env("STORAGE_ENDPOINT"), env("STORAGE_BUCKET"), env("STORAGE_ACCESS_KEY"), env("STORAGE_SECRET_KEY"), env("STORAGE_REGION") || "auto");
  } else if (env("STORAGE_DIR")) {
    cached = diskDriver(env("STORAGE_DIR"));
  } else {
    throw new StorageNotConfigured();
  }
  return cached;
}

export const storageConfigured = () => {
  try {
    storage();
    return true;
  } catch {
    return false;
  }
};

/** Pixel size of an image, or null (videos, PDFs, unreadable headers). */
export function dimensions(bytes: Uint8Array): { width: number; height: number } | null {
  try {
    const d = imageSize(bytes);
    if (!d.width || !d.height) return null;
    const swap = d.orientation !== undefined && d.orientation >= 5;
    return swap ? { width: d.height, height: d.width } : { width: d.width, height: d.height };
  } catch {
    return null;
  }
}

// --------------------------------------------------------- signed links ---

const signingKey = () => {
  const secret = process.env.QUBO_PREVIEW_SECRET?.trim();
  if (!secret) throw new Error("QUBO_PREVIEW_SECRET is required to sign file links.");
  return createHmac("sha256", secret).update("qubo-files").digest();
};

/** `?exp=…&sig=…` for a private file; any app holding the shared secret can verify it. */
export function signFile(key: string, ttlMs = 10 * 60_000, now = Date.now()) {
  const exp = Math.floor((now + ttlMs) / 1000);
  const sig = createHmac("sha256", signingKey()).update(`${key}\n${exp}`).digest("base64url");
  return { exp, sig };
}

export function verifyFile(key: string, exp: string | null, sig: string | null, now = Date.now()): boolean {
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) * 1000 < now) return false;
  const expected = createHmac("sha256", signingKey()).update(`${key}\n${exp}`).digest();
  const given = Buffer.from(sig, "base64url");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** `GET /api/media/<org>/<asset>.<ext>`: public, immutable (a new upload is a new id). */
export async function serveMedia(segments: string[]): Promise<Response> {
  const parsed = mediaKeyFromPath(segments.join("/"));
  if (!parsed) return new Response("Not found", { status: 404 });
  try {
    const file = await storage().get(parsed.key);
    if (!file) return new Response("Not found", { status: 404 });
    return new Response(file.body, { headers: serveHeaders(FILE_TYPES[parsed.ext]!.mime, file.size, { immutable: true }) });
  } catch (e) {
    if (e instanceof StorageNotConfigured) return new Response("Storage is not configured", { status: 503 });
    console.error("[media] read failed", parsed.key, e);
    return new Response("Unavailable", { status: 502 });
  }
}
