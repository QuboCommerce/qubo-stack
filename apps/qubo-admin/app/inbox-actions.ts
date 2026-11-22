"use server";

import { isEmail, LIMITS, PRIORITIES, SNOOZE_OPTIONS, STATUSES, type SnoozeOption } from "@qubo/inbox";
import { db } from "@qubo/db/client";
import { form } from "@qubo/db/schema";
import { and, eq } from "drizzle-orm";
import { deleteNote, escalate, getInboxFile, keepInboxFile, markUnread, readBytes, reply, updateConversation, updateConversations } from "@qubo/inbox/server";
import { parseDoc } from "@qubo/inbox";
import { uploadAsset } from "@qubo/storage/media";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireSiteFromForm } from "@/lib/admin";
import type { ActionState } from "@/lib/action-state";
import { assignableMembers } from "@/lib/inbox";

const id = z.uuid();

export async function replyAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const { site, user } = await requireSiteFromForm(formData);
  const t = await getTranslations("inbox.errors");
  const address = z.string().trim().max(320);
  const parsed = z
    .object({
      id,
      body: z.string().trim().max(20000),
      doc: z.string().max(200_000).optional(),
      internal: z.enum(["on"]).optional(),
      recipients: z.enum(["on"]).optional(),
      cc: z.array(address).max(LIMITS.ccRecipients),
      bcc: z.array(address).max(LIMITS.ccRecipients),
      fileIds: z.array(id).max(LIMITS.replyFiles),
      after: z.enum(["resolved", "pending"]).optional(),
    })
    .safeParse({ ...Object.fromEntries(formData), cc: formData.getAll("cc"), bcc: formData.getAll("bcc"), fileIds: formData.getAll("fileIds") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("invalidReply") };
  const doc = parseDoc(parsed.data.doc);
  if (!parsed.data.body && !parsed.data.fileIds.length) return { error: t("writeFirst") };
  // The recipients row is only on screen for e-mail replies; elsewhere the thread's list stays as it was.
  const edited = parsed.data.recipients === "on" && parsed.data.internal !== "on";
  const result = await reply({
    conversationId: parsed.data.id,
    siteId: site.id,
    author: { id: user.id, name: user.name },
    body: parsed.data.body,
    doc,
    internal: parsed.data.internal === "on",
    ...(edited && { cc: parsed.data.cc, bcc: parsed.data.bcc }),
    fileIds: parsed.data.fileIds,
  });
  // "Send and resolve": only once the reply is stored.
  if (parsed.data.after) await updateConversation(site.id, parsed.data.id, { status: parsed.data.after });
  revalidatePath(`/${site.slug}/inbox`, "layout");
  if (result.error) return { ok: true, at: Date.now(), error: t("emailFailed", { error: result.error }) };
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
    throw new Error((await getTranslations("inbox.errors"))("notMember"));
  }
  await updateConversation(site.id, p.id, {
    ...(p.status && { status: p.status }),
    ...(p.priority && { priority: p.priority }),
    ...(p.assigneeId !== undefined && { assigneeId: p.assigneeId === "me" ? user.id : p.assigneeId || null }),
    ...(p.unread && { unread: p.unread === "true" }),
    ...(p.snooze && { status: "snoozed" as const, unread: false, snoozedUntil: new Date(Date.now() + SNOOZE_OPTIONS[p.snooze][1]) }),
  });
  revalidatePath(`/${site.slug}/inbox`, "layout");
}

/** Turns the thread into a numbered ticket (idempotent). */
export async function escalateAction(formData: FormData): Promise<{ number: number | null }> {
  const { site, user } = await requireSiteFromForm(formData);
  const number = await escalate(site.id, id.parse(formData.get("id")), { id: user.id, name: user.name });
  revalidatePath(`/${site.slug}/inbox`, "layout");
  return { number };
}

/** Opening a thread marks it read (no revalidate: the badge refreshes via the event). */
export async function markReadAction(siteSlug: string, conversationId: string) {
  const { site } = await siteFor(siteSlug);
  await updateConversation(site.id, id.parse(conversationId), { unread: false, lastReadAt: new Date() });
}

const siteFor = (slug: string) => {
  const fd = new FormData();
  fd.set("site", slug);
  return requireSiteFromForm(fd);
};

const bulkSchema = z.object({
  ids: z.array(id).min(1).max(500),
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assigneeId: z.string().max(64).nullable().optional(),
  unread: z.boolean().optional(),
  snooze: z.enum(Object.keys(SNOOZE_OPTIONS) as [SnoozeOption, ...SnoozeOption[]]).optional(),
  spam: z.boolean().optional(),
  addTags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(20).optional(),
  removeTags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(20).optional(),
});
export type ConversationsPatch = Omit<z.input<typeof bulkSchema>, "ids">;

/** Menus and bulk actions: one patch on one or many threads. Returns how many changed. */
export async function patchConversationsAction(siteSlug: string, ids: string[], patch: ConversationsPatch): Promise<{ count: number }> {
  const { site, user } = await siteFor(siteSlug);
  const p = bulkSchema.parse({ ids, ...patch });
  if (p.assigneeId && p.assigneeId !== "me" && !(await assignableMembers(site.organizationId)).some((m) => m.id === p.assigneeId)) {
    throw new Error((await getTranslations("inbox.errors"))("notMember"));
  }
  const addTags = [...(p.addTags ?? []), ...(p.spam === true ? ["spam"] : [])];
  const removeTags = [...(p.removeTags ?? []), ...(p.spam === false ? ["spam"] : [])];
  const count = await updateConversations(site.id, p.ids, {
    ...(p.status && { status: p.status }),
    ...(p.spam === true && { status: "resolved" as const, unread: false }),
    ...(p.priority && { priority: p.priority }),
    ...(p.assigneeId !== undefined && { assigneeId: p.assigneeId === "me" ? user.id : p.assigneeId || null }),
    ...(p.unread !== undefined && { unread: p.unread, ...(p.unread ? { lastReadAt: null } : { lastReadAt: new Date() }) }),
    ...(p.snooze && { status: "snoozed" as const, unread: false, snoozedUntil: new Date(Date.now() + SNOOZE_OPTIONS[p.snooze][1]) }),
    ...(addTags.length && { addTags }),
    ...(removeTags.length && { removeTags }),
  });
  revalidatePath(`/${site.slug}/inbox`, "layout");
  return { count };
}

/** "Mark unread from here": the thread is unread again and opens with a "New" line above that message. */
export async function markUnreadAction(siteSlug: string, conversationId: string, fromMessageId?: string) {
  const { site } = await siteFor(siteSlug);
  await markUnread(site.id, id.parse(conversationId), fromMessageId ? id.parse(fromMessageId) : undefined);
  revalidatePath(`/${site.slug}/inbox`, "layout");
}

/** Deletes one of your own internal notes. */
export async function deleteNoteAction(siteSlug: string, messageId: string): Promise<{ ok: boolean }> {
  const { site, user } = await siteFor(siteSlug);
  const ok = await deleteNote(site.id, id.parse(messageId), user.id);
  revalidatePath(`/${site.slug}/inbox`, "layout");
  return { ok };
}

const formSchema = (t: Awaited<ReturnType<typeof getTranslations<"inbox.errors">>>) => z.object({
  formId: id,
  name: z.string().trim().min(1, t("formNameRequired")).max(80, t("formNameLong")),
  notifyEmails: z
    .string()
    .max(2000)
    .transform((v) => [...new Set(v.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))])
    .refine((list) => list.length <= 10, t("tooManyAddresses"))
    .refine((list) => list.every(isEmail), t("badAddress")),
});

/** Inbox settings: a form's display name and who is e-mailed on each submission. */
export async function updateFormAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const { site } = await requireSiteFromForm(formData);
  const t = await getTranslations("inbox.errors");
  if (site.memberRole !== "OWNER" && site.memberRole !== "ADMIN") return { error: t("noPermission") };
  const parsed = formSchema(t).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("invalidForm") };
  const [row] = await db
    .update(form)
    .set({ name: parsed.data.name, notifyEmails: parsed.data.notifyEmails })
    .where(and(eq(form.id, parsed.data.formId), eq(form.siteId, site.id)))
    .returning({ id: form.id });
  if (!row) return { error: t("formGone") };
  revalidatePath(`/${site.slug}/settings/inbox`);
  return { ok: true, at: Date.now() };
}

/** Keep a visitor's chat file past its 30 days, or let it expire again. */
export async function keepFileAction(siteSlug: string, fileId: string, keep: boolean) {
  const fd = new FormData();
  fd.set("site", siteSlug);
  const { site } = await requireSiteFromForm(fd);
  const t = await getTranslations("inbox.errors");
  const res = await keepInboxFile(site.id, id.parse(fileId), keep);
  revalidatePath(`/${site.slug}/inbox`, "layout");
  return res ? { ok: true as const } : { ok: false as const, error: t("onlyChat") };
}

/** Copies a conversation file into the site's media library (the original stays in the thread). */
export async function saveFileToMediaAction(siteSlug: string, fileId: string) {
  const fd = new FormData();
  fd.set("site", siteSlug);
  const { site, user } = await requireSiteFromForm(fd);
  const t = await getTranslations("inbox.errors");
  const row = await getInboxFile(id.parse(fileId));
  if (!row || row.siteId !== site.id) return { ok: false as const, error: t("fileExpired") };
  const bytes = await readBytes(row.key);
  if (!bytes) return { ok: false as const, error: t("fileExpired") };
  const res = await uploadAsset({ orgId: site.organizationId, siteId: site.id, userId: user.id, filename: row.filename, bytes });
  if (!res.ok) return { ok: false as const, error: res.error };
  return { ok: true as const, name: res.item.filename };
}

/** `<form action>` flavour of escalateAction. */
export async function escalateFormAction(formData: FormData) {
  await escalateAction(formData);
}
