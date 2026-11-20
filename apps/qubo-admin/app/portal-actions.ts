"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { heartbeat, link, PortalError, unlink } from "@qubo/portal-client";
import { requireSiteFromForm } from "@/lib/admin";

const back = (slug: string, q = "") => revalidatePath(`/${slug}/settings/portal${q}`);

export async function linkPortal(_: { error?: string } | null, formData: FormData): Promise<{ error?: string } | null> {
  const t = await getTranslations("portal.errors");
  const { site } = await requireSiteFromForm(formData);
  const token = String(formData.get("token") ?? "").trim();
  const portalUrl = String(formData.get("portalUrl") ?? "").trim() || undefined;
  const name = String(formData.get("name") ?? "").trim() || site.name;
  if (!token) return { error: t("tokenRequired") };
  try {
    await link({ token, portalUrl, name });
  } catch (error) {
    if (error instanceof PortalError) {
      const msg: Record<string, string> = {
        invalid_token: t("invalidToken"),
        "license.instances_exceeded": t("instancesExceeded"),
        already_linked: t("alreadyLinked"),
      };
      return { error: msg[error.code] ?? t("portalReplied", { status: error.status, code: error.code }) };
    }
    return { error: error instanceof Error && /fetch|timeout|ECONN/i.test(error.message) ? t("unreachable") : t("linkFailed") };
  }
  back(site.slug);
  return null;
}

export async function refreshLicence(formData: FormData) {
  const { site } = await requireSiteFromForm(formData);
  await heartbeat({ quiet: true });
  back(site.slug);
}

export async function unlinkPortal(formData: FormData) {
  const { site } = await requireSiteFromForm(formData);
  await unlink();
  back(site.slug);
}
