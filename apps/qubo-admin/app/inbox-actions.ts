"use server";

import { isEmail, PRIORITIES, SNOOZE_OPTIONS, STATUSES, type SnoozeOption } from "@qubo/inbox";
import { db } from "@qubo/db/client";
import { form } from "@qubo/db/schema";
import { and, eq } from "drizzle-orm";
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
  snooze: z.enum(Object.keys(SNOOZE_OPTIONS) as [SnoozeOption, ...SnoozeOption[]]).optional(),
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
    ...(p.snooze && { status: "snoozed" as const, unread: false, snoozedUntil: new Date(Date.now() + SNOOZE_OPTIONS[p.snooze][1]) }),
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

const formSchema = z.object({
  formId: id,
  name: z.string().trim().min(1, "Give the form a name.").max(80, "Form names are limited to 80 characters."),
  notifyEmails: z
    .string()
    .max(2000)
    .transform((v) => [...new Set(v.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))])
    .refine((list) => list.length <= 10, "Up to 10 addresses per form.")
    .refine((list) => list.every(isEmail), "One of the addresses isn't a valid e-mail."),
});

/** Inbox settings: a form's display name and who is e-mailed on each submission. */
export async function updateFormAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const { site } = await requireSiteFromForm(formData);
  if (site.memberRole !== "OWNER" && site.memberRole !== "ADMIN") return { error: "You don't have permission to change settings." };
  const parsed = formSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid form settings." };
  const [row] = await db
    .update(form)
    .set({ name: parsed.data.name, notifyEmails: parsed.data.notifyEmails })
    .where(and(eq(form.id, parsed.data.formId), eq(form.siteId, site.id)))
    .returning({ id: form.id });
  if (!row) return { error: "That form no longer exists." };
  revalidatePath(`/${site.slug}/settings/inbox`);
  return { ok: true, at: Date.now() };
}
