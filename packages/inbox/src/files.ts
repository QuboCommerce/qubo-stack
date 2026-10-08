import { db } from "@qubo/db/client";
import { inboxFile, message, type MessageAttachment } from "@qubo/db/schema";
import { CHAT_ATTACHMENTS, checkFile, cleanFilename, inboxKey, problemMessage, serveHeaders, type UploadProfile } from "@qubo/storage";
import { storage, StorageNotConfigured } from "@qubo/storage/server";
import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { LIMITS } from "./index";

export type FileSource = (typeof inboxFile.$inferInsert)["source"];
export type IncomingFile = { filename: string; bytes: Uint8Array };
export type CheckedUpload = { name: string; ext: string; mime: string; bytes: Uint8Array };

/** All-or-nothing validation, so a message never goes out with half its files. */
export function checkUploads(profile: UploadProfile, files: IncomingFile[], max: number): { ok: true; files: CheckedUpload[] } | { ok: false; error: string } {
  if (files.length > max) return { ok: false, error: `Up to ${max} files per message.` };
  const out: CheckedUpload[] = [];
  for (const f of files) {
    const name = cleanFilename(f.filename);
    const checked = checkFile(profile, name, f.bytes);
    if (!checked.ok) return { ok: false, error: problemMessage(checked.problem, name, profile) };
    out.push({ name, ext: checked.file.ext, mime: checked.file.mime, bytes: f.bytes });
  }
  return { ok: true, files: out };
}

export const toAttachment = (r: { id: string; filename: string; size: number; mime: string }): MessageAttachment => ({
  id: r.id,
  name: r.filename,
  size: r.size,
  type: r.mime.split(";")[0],
});

/**
 * Writes checked files to storage and records them. Bytes go first: a crash
 * between the two leaves an unreferenced object, never a row without a file.
 */
export async function storeFiles(
  files: CheckedUpload[],
  to: { siteId: string; conversationId: string; messageId: string | null; source: FileSource; uploadedBy?: string | null },
): Promise<MessageAttachment[]> {
  if (!files.length) return [];
  const store = storage();
  const expiresAt = to.source === "chat" ? new Date(Date.now() + CHAT_ATTACHMENTS.ttlMs) : to.messageId ? null : new Date(Date.now() + LIMITS.draftFileMs);
  const rows = files.map((f) => {
    const id = crypto.randomUUID();
    return { ...f, id, key: inboxKey(to.siteId, to.conversationId, id, f.ext) };
  });
  const written: string[] = [];
  try {
    for (const r of rows) {
      await store.put(r.key, r.bytes, r.mime);
      written.push(r.key);
    }
    const inserted = await db
      .insert(inboxFile)
      .values(
        rows.map((r) => ({
          id: r.id,
          siteId: to.siteId,
          conversationId: to.conversationId,
          messageId: to.messageId,
          key: r.key,
          filename: r.name,
          mime: r.mime,
          size: r.bytes.byteLength,
          source: to.source,
          uploadedBy: to.uploadedBy ?? null,
          expiresAt,
        })),
      )
      .returning();
    return inserted.map(toAttachment);
  } catch (e) {
    await Promise.all(written.map((k) => store.delete(k).catch(() => {})));
    throw e;
  }
}

/** Puts stored files on their message (display copy in `message.attachments`). */
export async function linkFiles(messageId: string, attachments: MessageAttachment[]) {
  if (!attachments.length) return;
  await db.update(message).set({ attachments }).where(eq(message.id, messageId));
}

/**
 * Staff drafts → a sent reply. Only the author's own unsent uploads in this
 * conversation are taken; anything else in `ids` is ignored.
 */
export async function claimDraftFiles(conversationId: string, authorId: string, messageId: string, ids: string[]): Promise<MessageAttachment[]> {
  if (!ids.length) return [];
  const rows = await db
    .update(inboxFile)
    .set({ messageId, expiresAt: null })
    .where(
      and(
        inArray(inboxFile.id, ids.slice(0, LIMITS.replyFiles)),
        eq(inboxFile.conversationId, conversationId),
        eq(inboxFile.uploadedBy, authorId),
        isNull(inboxFile.messageId),
      ),
    )
    .returning();
  const order = new Map(ids.map((id, i) => [id, i]));
  return rows.sort((a, b) => order.get(a.id)! - order.get(b.id)!).map(toAttachment);
}

export const getInboxFile = (id: string) => db.query.inboxFile.findFirst({ where: eq(inboxFile.id, id) });

/** Bytes of a file, for e-mailing it. */
export async function readBytes(key: string): Promise<Uint8Array | null> {
  const file = await storage().get(key);
  return file ? new Uint8Array(await new Response(file.body).arrayBuffer()) : null;
}

/**
 * Streams a private file. Callers check access first. Images and PDFs open
 * inline (sandboxed by CSP); everything else downloads.
 */
export async function serveInboxFile(row: { key: string; mime: string; filename: string }, opts: { download?: boolean } = {}): Promise<Response> {
  try {
    const file = await storage().get(row.key);
    if (!file) return new Response("This file has expired.", { status: 410 });
    const inline = !opts.download && /^(image\/(png|jpeg|gif|webp|avif)|application\/pdf)/.test(row.mime);
    const headers = serveHeaders(row.mime, file.size, { immutable: false, download: inline ? undefined : row.filename });
    if (inline) headers["content-disposition"] = `inline; filename*=UTF-8''${encodeURIComponent(row.filename)}`;
    return new Response(file.body, { headers });
  } catch (e) {
    if (e instanceof StorageNotConfigured) return new Response("Storage is not configured", { status: 503 });
    console.error("[inbox] file read failed", row.key, e);
    return new Response("Unavailable", { status: 502 });
  }
}

/** Keep a visitor's file for good, or put it back on the 30-day clock. */
export async function keepInboxFile(siteId: string, id: string, keep: boolean) {
  const row = await db.query.inboxFile.findFirst({ where: and(eq(inboxFile.id, id), eq(inboxFile.siteId, siteId)) });
  if (!row || row.source !== "chat" || !row.messageId) return null;
  const expiresAt = keep ? null : new Date(Math.max(Date.now(), row.createdAt.getTime() + CHAT_ATTACHMENTS.ttlMs));
  await db.update(inboxFile).set({ expiresAt }).where(eq(inboxFile.id, id));
  return { expiresAt };
}

/**
 * Deletes expired chat files and abandoned staff drafts. The message keeps its
 * display copy, so the thread shows the file as expired. Runs hourly in the API.
 */
export async function purgeInboxFiles(now = new Date()): Promise<number> {
  const due = await db
    .select({ id: inboxFile.id, key: inboxFile.key })
    .from(inboxFile)
    .where(or(lt(inboxFile.expiresAt, now), and(isNull(inboxFile.messageId), lt(inboxFile.createdAt, new Date(now.getTime() - LIMITS.draftFileMs)))))
    .limit(500);
  if (!due.length) return 0;
  const store = storage();
  const gone: string[] = [];
  for (const f of due) {
    try {
      await store.delete(f.key);
      gone.push(f.id);
    } catch (e) {
      console.error("[inbox] purge failed", f.key, e);
    }
  }
  if (gone.length) await db.delete(inboxFile).where(inArray(inboxFile.id, gone));
  return gone.length;
}

