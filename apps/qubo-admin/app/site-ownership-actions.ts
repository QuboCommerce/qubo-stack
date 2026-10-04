"use server";

import { revalidatePath } from "next/cache";
import { notifyRevalidate } from "@qubo/studio";
import type { ActionState } from "@/lib/action-state";
import { requireSiteFromForm } from "@/lib/admin";
import { moveDraft, OwnershipError, publish } from "@/lib/site-ownership";

function target(formData: FormData) {
  const org = formData.get("organizationId");
  if (typeof org !== "string" || !org) throw new OwnershipError("Choose an organisation.");
  return org;
}

const fail = (e: unknown): ActionState => ({ error: e instanceof OwnershipError ? e.message : "Something went wrong." });

export async function publishSiteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { siteId, site } = await requireSiteFromForm(formData);
    if (formData.get("confirm") !== "on") return { error: "Confirm the organisation to publish." };
    await publish(siteId, target(formData));
    await notifyRevalidate(site.slug, []);
    revalidatePath("/", "layout");
    return { ok: true, at: Date.now() };
  } catch (e) {
    return fail(e);
  }
}

export async function moveDraftSiteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { siteId } = await requireSiteFromForm(formData);
    await moveDraft(siteId, target(formData));
    revalidatePath("/", "layout");
    return { ok: true, at: Date.now() };
  } catch (e) {
    return fail(e);
  }
}
