"use server";

import { PRIORITIES, STATUSES } from "@qubo/inbox";
import { reply, updateConversation } from "@qubo/inbox/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSiteFromForm } from "@/lib/admin";
import type { ActionState } from "@/lib/action-state";
import { assignableMembers } from "@/lib/inbox";

const id = z.uuid();

export async function replyAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const { site, user } = await requireSiteFromForm(formData);
  const parsed = z
    .object({ id, body: z.string().trim().min(1, "Write a message first.").max(20000), internal: z.enum(["on"]).optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid reply." };
  const result = await reply({
    conversationId: parsed.data.id,
    siteId: site.id,
    author: { id: user.id, name: user.name },
    body: parsed.data.body,
    internal: parsed.data.internal === "on",
  });
  revalidatePath(`/${site.slug}/inbox`);
  if (result.error) return { ok: true, at: Date.now(), error: `Saved, but the e-mail wasn't sent: ${result.error}` };
  return { ok: true, at: Date.now() };
}

const patchSchema = z.object({
  id,
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assigneeId: z.string().max(64).optional(),
  unread: z.enum(["true", "false"]).optional(),
});

/** One field at a time from the thread header controls. */
export async function updateConversationAction(formData: FormData) {
  const { site, user } = await requireSiteFromForm(formData);
  const p = patchSchema.parse(Object.fromEntries(formData));
  if (p.assigneeId && p.assigneeId !== "me" && !(await assignableMembers(site.organizationId)).some((m) => m.id === p.assigneeId)) {
    throw new Error("That person isn't a member of this organisation.");
  }
  await updateConversation(site.id, p.id, {
    ...(p.status && { status: p.status }),
    ...(p.priority && { priority: p.priority }),
    ...(p.assigneeId !== undefined && { assigneeId: p.assigneeId === "me" ? user.id : p.assigneeId || null }),
    ...(p.unread && { unread: p.unread === "true" }),
  });
  revalidatePath(`/${site.slug}/inbox`);
}

/** Opening a thread marks it read (no revalidate: the badge refreshes via the event). */
export async function markReadAction(siteSlug: string, conversationId: string) {
  const fd = new FormData();
  fd.set("site", siteSlug);
  const { site } = await requireSiteFromForm(fd);
  await updateConversation(site.id, id.parse(conversationId), { unread: false });
}
