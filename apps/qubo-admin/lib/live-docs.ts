import "server-only";
import fjp, { type Operation } from "fast-json-patch";

/**
 * The lease holder's unsaved canvas, per document, in this process. The
 * holder sends a snapshot when it starts (new `epoch`) and then JSON Patch
 * batches (`seq` + 1 each). Followers replay the batches from events and
 * fetch the snapshot when they join or miss one. Autosave persists the draft
 * independently; this only makes followers see edits before that.
 */
type Live = { epoch: string; seq: number; data: unknown; clientId: string; at: number };

const g = globalThis as unknown as { __quboLive?: Map<string, Live> };
const docs = (g.__quboLive ??= new Map());
const MAX_AGE = 60 * 60_000;

function sweep() {
  const cutoff = Date.now() - MAX_AGE;
  for (const [id, l] of docs) if (l.at < cutoff) docs.delete(id);
}

export function getLive(documentId: string) {
  sweep();
  const l = docs.get(documentId);
  return l ? { epoch: l.epoch, seq: l.seq, data: l.data } : null;
}

export function setSnapshot(documentId: string, clientId: string, data: unknown) {
  const live: Live = { epoch: crypto.randomUUID(), seq: 0, data, clientId, at: Date.now() };
  docs.set(documentId, live);
  return { epoch: live.epoch, seq: 0 };
}

/** Applies a batch; `resync` when it doesn't follow the stored state (client then sends a snapshot). */
export function applyOps(documentId: string, clientId: string, epoch: string, seq: number, ops: Operation[]) {
  const l = docs.get(documentId);
  if (!l || l.clientId !== clientId || l.epoch !== epoch || seq !== l.seq + 1) return { resync: true as const };
  try {
    l.data = fjp.applyPatch(l.data, ops, true, false).newDocument;
  } catch {
    docs.delete(documentId);
    return { resync: true as const };
  }
  l.seq = seq;
  l.at = Date.now();
  return { epoch, seq };
}
