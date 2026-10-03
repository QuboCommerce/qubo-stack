"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/admin";
import { endSession, listDevices } from "@/lib/sessions";

/** Signs out one of your other devices (Settings → Security). */
export async function revokeSession(formData: FormData) {
  const me = await requireUser();
  const id = z.string().min(1).max(100).parse(formData.get("sessionId"));
  if (id === me.sessionId) throw new Error("Use Sign out to end this device's session.");
  await endSession(me.id, id, "revoked", me.sessionId);
  revalidatePath(`/${z.string().parse(formData.get("site"))}/settings/security`);
}

/** Signs out every other device. */
export async function revokeOtherSessions(formData: FormData) {
  const me = await requireUser();
  for (const d of await listDevices(me.id)) if (d.live && d.sessionId !== me.sessionId) await endSession(me.id, d.sessionId, "revoked", me.sessionId);
  revalidatePath(`/${z.string().parse(formData.get("site"))}/settings/security`);
}
