import "server-only";
import { getHub } from "@qubo/realtime/server";
import type { PlatformEvent } from "@qubo/realtime";
import { requireUser } from "@/lib/admin";

type Action = "created" | "updated" | "deleted";

/** Publishes a platform event; never fails the calling action. */
export async function emit(event: PlatformEvent) {
  try {
    await getHub().publish(event);
  } catch (e) {
    console.error("[events] publish failed", event.type, e);
  }
}

async function by() {
  const u = await requireUser();
  return { id: u.id, name: u.name };
}

/** `entity.updated` for a row of a site-scoped table. */
export async function emitEntity(siteId: string, table: string, id: string, action: Action = "updated") {
  await emit({ type: "entity.updated", siteId, payload: { table, id, action, by: await by() } });
}

export async function emitDocumentPublished(siteId: string, documentId: string, version: number) {
  await emit({ type: "document.published", siteId, payload: { documentId, version, by: await by() } });
}

export async function emitThemePublished(siteId: string, themeId: string) {
  await emit({ type: "theme.published", siteId, payload: { themeId, by: await by() } });
}
