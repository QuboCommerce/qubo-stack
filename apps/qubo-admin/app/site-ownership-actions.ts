"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { notifyRevalidate } from "@qubo/studio";
import type { ActionState } from "@/lib/action-state";
import { requireSiteFromForm } from "@/lib/admin";
import { moveDraft, OwnershipError, publish, purgeSite, restoreSite, trashSite } from "@/lib/site-ownership";

async function target(formData: FormData) {
  const org = formData.get("organizationId");
  if (typeof org !== "string" || !org) throw new OwnershipError((await getTranslations("settings.ownership"))("chooseOrg"));
  return org;
}

const fail = async (e: unknown): Promise<ActionState> => ({ error: e instanceof OwnershipError ? e.message : (await getTranslations("settings.ownership"))("generic") });

export async function publishSiteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { siteId, site } = await requireSiteFromForm(formData);
    if (formData.get("confirm") !== "on") return { error: (await getTranslations("settings.ownership"))("confirmPublish") };
    await publish(siteId, await target(formData));
    await notifyRevalidate(site.slug, []);
    revalidatePath("/", "layout");
    return { ok: true, at: Date.now() };
  } catch (e) {
    return await fail(e);
  }
}

export async function moveDraftSiteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { siteId } = await requireSiteFromForm(formData);
    await moveDraft(siteId, await target(formData));
    revalidatePath("/", "layout");
    return { ok: true, at: Date.now() };
  } catch (e) {
    return await fail(e);
  }
}

async function siteId(formData: FormData) {
  const id = formData.get("siteId");
  if (typeof id !== "string" || !id) throw new OwnershipError((await getTranslations("settings.ownership"))("siteNotFound"));
  return id;
}

/** Draft to the recycle bin. Returns where to go when the current site was the one deleted. */
export async function trashSiteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await trashSite(await siteId(formData));
    revalidatePath("/", "layout");
    return { ok: true, at: Date.now() };
  } catch (e) {
    return await fail(e);
  }
}

export async function restoreSiteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await restoreSite(await siteId(formData));
    revalidatePath("/", "layout");
    return { ok: true, at: Date.now() };
  } catch (e) {
    return await fail(e);
  }
}

export async function purgeSiteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await purgeSite(await siteId(formData));
    revalidatePath("/", "layout");
    return { ok: true, at: Date.now() };
  } catch (e) {
    return await fail(e);
  }
}
