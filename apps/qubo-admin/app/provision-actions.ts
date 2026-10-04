"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createOrganization, createSite, SITE_LOCALES, StudioError } from "@qubo/studio";
import { siteTypes } from "@qubo/blocks/core";
import type { ActionState } from "@/lib/action-state";
import { getAccess, requireUser } from "@/lib/admin";
import { manageableOrgs } from "@/lib/site-ownership";

const text = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
};

const fail = (e: unknown): ActionState => ({ error: e instanceof StudioError ? e.message : "Something went wrong." });

/** Plan ceiling: organisations. Any member may create one; they become its owner. */
export async function createOrganizationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const [user, access] = await Promise.all([requireUser(), getAccess()]);
    if (!access.orgs.canCreate) return { error: `Your ${access.entitlements.plan} plan covers ${access.orgs.limit} organisation${access.orgs.limit === 1 ? "" : "s"}.` };
    await createOrganization({
      name: text(formData, "name"),
      legalName: text(formData, "legalName") || null,
      companyNumber: text(formData, "companyNumber") || null,
      userId: user.id,
    });
    revalidatePath("/", "layout");
    return { ok: true, at: Date.now() };
  } catch (e) {
    return fail(e);
  }
}

/** Plan ceiling: sites, counted across all organisations. Redirects into the new site. */
export async function createSiteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let slug: string;
  try {
    const [user, access, orgs] = await Promise.all([requireUser(), getAccess(), manageableOrgs()]);
    if (!access.sites.canCreate) return { error: `Your ${access.entitlements.plan} plan covers ${access.sites.limit} site${access.sites.limit === 1 ? "" : "s"}. Remove one or upgrade.` };
    const organizationId = text(formData, "organizationId");
    if (!orgs.some((o) => o.id === organizationId)) return { error: "Choose an organisation you manage." };
    const type = text(formData, "type");
    if (!(siteTypes as readonly string[]).includes(type)) return { error: "Pick what the site is for." };
    const locale = text(formData, "locale");
    if (!(SITE_LOCALES as readonly string[]).includes(locale)) return { error: "Pick a language." };
    const created = await createSite({ organizationId, name: text(formData, "name"), type: type as (typeof siteTypes)[number], locale, userId: user.id });
    slug = created.slug;
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/", "layout");
  redirect(`/${slug}`);
}
