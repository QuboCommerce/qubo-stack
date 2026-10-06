"use server";

import type { Capability } from "@qubo/blocks";
import { blueprintLocale, pageBlueprint } from "@qubo/blocks/presets";
import * as studio from "@qubo/studio";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { requireSiteFromForm } from "@/lib/admin";
import { emitEntity } from "@/lib/events";
import { studioHref } from "@/lib/view-meta";

const text = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
};

const fail = (e: unknown): ActionState => {
  if (e instanceof studio.StudioError) return { error: e.message };
  console.error("[page-action]", e);
  return { error: "Something went wrong." };
};

/**
 * Creates a page from a blueprint (starter sections, localized title and
 * URL) or blank, then opens it in the Studio. A blueprint whose modules are
 * off is refused here too, so the UI lock is not the only guard.
 */
export async function createPageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let href: string;
  try {
    const { site, user } = await requireSiteFromForm(formData);
    const scope: studio.Scope = { siteId: site.id, userId: user.id };
    const capabilities = (site.capabilities ?? []) as Capability[];
    const blueprintId = text(formData, "blueprint");
    const blueprint = blueprintId ? pageBlueprint(blueprintId) : undefined;
    if (blueprintId && !blueprint) return { error: "Unknown page blueprint." };
    if (blueprint) {
      const missing = blueprint.requires.filter((c) => !capabilities.includes(c));
      if (missing.length) return { error: `This page needs the ${missing.join(", ")} module. Switch it on in Settings first.` };
    }
    const locale = blueprintLocale(site.locale);
    const title = text(formData, "title") || blueprint?.title[locale] || "";
    const slug = text(formData, "slug") || blueprint?.slug[locale];
    const created = await studio.createPage(scope, {
      title,
      slug,
      metaDescription: blueprint?.metaDescription[locale],
      data: blueprint?.starter({ locale, siteName: site.name, capabilities }),
    });
    await emitEntity(site.id, "page", created.id, "created");
    revalidatePath(`/${site.slug}/online-store/pages`);
    href = studioHref(site.slug, `page:${created.id}`);
  } catch (e) {
    return fail(e);
  }
  redirect(href);
}

/** Deletes a page and its document. Published pages vanish from the storefront at once. */
export async function deletePageAction(formData: FormData) {
  const { site, user } = await requireSiteFromForm(formData);
  const id = text(formData, "id");
  await studio.deletePage({ siteId: site.id, userId: user.id }, id);
  await emitEntity(site.id, "page", id, "deleted");
  await studio.notifyRevalidate(site.slug, []);
  revalidatePath(`/${site.slug}/online-store/pages`);
}
