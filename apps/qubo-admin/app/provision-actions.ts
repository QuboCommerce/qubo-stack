"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createOrganization, createSite, SITE_LOCALES, StudioError } from "@qubo/studio";
import { siteTypes } from "@qubo/blocks/core";
import type { ActionState } from "@/lib/action-state";
import { getAccess, requireUser } from "@/lib/admin";
import { manageableOrgs } from "@/lib/site-ownership";

const text = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
};

const fail = async (e: unknown): Promise<ActionState> => ({ error: e instanceof StudioError ? e.message : (await getTranslations("settings"))("provision.generic") });

/** Plan ceiling: organisations. Any member may create one; they become its owner. */
export async function createOrganizationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getTranslations("settings.provision");
  try {
    const [user, access] = await Promise.all([requireUser(), getAccess()]);
    if (!access.orgs.canCreate) return { error: t("orgLimit", { plan: access.entitlements.plan, count: access.orgs.limit ?? 0 }) };
    await createOrganization({
      name: text(formData, "name"),
      legalName: text(formData, "legalName") || null,
      companyNumber: text(formData, "companyNumber") || null,
      userId: user.id,
    });
    revalidatePath("/", "layout");
    return { ok: true, at: Date.now() };
  } catch (e) {
    return await fail(e);
  }
}

/** Plan ceiling: sites, counted across all organisations. Redirects into the new site. */
export async function createSiteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getTranslations("settings.provision");
  let slug: string;
  try {
    const [user, access, orgs] = await Promise.all([requireUser(), getAccess(), manageableOrgs()]);
    if (!access.sites.canCreate) return { error: t("siteLimit", { plan: access.entitlements.plan, count: access.sites.limit ?? 0 }) };
    const organizationId = text(formData, "organizationId");
    if (!orgs.some((o) => o.id === organizationId)) return { error: t("chooseOrg") };
    const type = text(formData, "type");
    if (!(siteTypes as readonly string[]).includes(type)) return { error: t("pickType") };
    const locale = text(formData, "locale");
    if (!(SITE_LOCALES as readonly string[]).includes(locale)) return { error: t("pickLanguage") };
    const created = await createSite({ organizationId, name: text(formData, "name"), type: type as (typeof siteTypes)[number], locale, userId: user.id });
    slug = created.slug;
  } catch (e) {
    return await fail(e);
  }
  revalidatePath("/", "layout");
  redirect(`/${slug}`);
}
