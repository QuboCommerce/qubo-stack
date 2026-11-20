"use server";

import { isEmail, LIMITS, PRIORITIES, SNOOZE_OPTIONS, STATUSES, type SnoozeOption } from "@qubo/inbox";
import { db } from "@qubo/db/client";
import { form } from "@qubo/db/schema";
import { and, eq } from "drizzle-orm";
import { getInboxFile, keepInboxFile, readBytes, reply, updateConversation } from "@qubo/inbox/server";
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
  const parsed = z
    .object({ id, body: z.string().trim().max(20000), internal: z.enum(["on"]).optional(), fileIds: z.array(id).max(LIMITS.replyFiles) })
    .safeParse({ ...Object.fromEntries(formData), fileIds: formData.getAll("fileIds") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("invalidReply") };
  if (!parsed.data.body && !parsed.data.fileIds.length) return { error: t("writeFirst") };
  const result = await reply({
    conversationId: parsed.data.id,
    siteId: site.id,
    author: { id: user.id, name: user.name },
    body: parsed.data.body,
    internal: parsed.data.internal === "on",
    fileIds: parsed.data.fileIds,
  });
  revalidatePath(`/${site.slug}/inbox`);
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
  revalidatePath(`/${site.slug}/inbox`);
}

/** Opening a thread marks it read (no revalidate: the badge refreshes via the event). */
export async function markReadAction(siteSlug: string, conversationId: string) {
  const fd = new FormData();
  fd.set("site", siteSlug);
  const { site } = await requireSiteFromForm(fd);
  await updateConversation(site.id, id.parse(conversationId), { unread: false });
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
  revalidatePath(`/${site.slug}/inbox`);
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
