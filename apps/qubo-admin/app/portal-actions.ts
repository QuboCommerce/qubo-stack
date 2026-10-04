"use server";

import { revalidatePath } from "next/cache";
import { heartbeat, link, PortalError, unlink } from "@qubo/portal-client";
import { requireSiteFromForm } from "@/lib/admin";

const back = (slug: string, q = "") => revalidatePath(`/${slug}/settings/portal${q}`);

export async function linkPortal(_: { error?: string } | null, formData: FormData): Promise<{ error?: string } | null> {
  const { site } = await requireSiteFromForm(formData);
  const token = String(formData.get("token") ?? "").trim();
  const portalUrl = String(formData.get("portalUrl") ?? "").trim() || undefined;
  const name = String(formData.get("name") ?? "").trim() || site.name;
  if (!token) return { error: "Paste the registration token from the Portal." };
  try {
    await link({ token, portalUrl, name });
  } catch (error) {
    if (error instanceof PortalError) {
      const msg: Record<string, string> = {
        invalid_token: "That token is invalid, expired or already used.",
        "license.instances_exceeded": "This Portal organization has reached its instance limit.",
        already_linked: "This instance is already linked.",
      };
      return { error: msg[error.code] ?? `Portal replied ${error.status} (${error.code}).` };
    }
    return { error: error instanceof Error && /fetch|timeout|ECONN/i.test(error.message) ? "Could not reach the Portal. Check the URL and try again." : "Linking failed." };
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
