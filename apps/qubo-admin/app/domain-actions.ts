"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "@qubo/db/client";
import { siteDomain } from "@qubo/db/schema";
import { parseDomain } from "@qubo/domains";
import { checkDomain, hostnameTaken } from "@qubo/domains/server";
import type { ActionState } from "@/lib/action-state";
import { getAccess, requireSiteFromForm } from "@/lib/admin";

/** A manual "Check now" is answered from the last report if it is younger than this. */
const MIN_CHECK_GAP_MS = 10_000;

const text = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
};

async function requireManager(formData: FormData) {
  const ctx = await requireSiteFromForm(formData);
  if (ctx.site.memberRole !== "OWNER" && ctx.site.memberRole !== "ADMIN") throw new Error("Only owners and admins can manage domains.");
  return ctx;
}

async function ownDomain(siteId: string, formData: FormData) {
  const id = text(formData, "domainId");
  const [row] = id ? await db.select().from(siteDomain).where(and(eq(siteDomain.id, id), eq(siteDomain.siteId, siteId))) : [];
  if (!row) throw new Error("Domain not found.");
  return row;
}

const done = (slug: string): ActionState => {
  revalidatePath(`/${slug}/settings/domains`);
  revalidatePath(`/${slug}`, "layout");
  return { ok: true, at: Date.now() };
};

const fail = (e: unknown): ActionState => ({ error: e instanceof Error ? e.message : "Something went wrong." });

/** Adds a domain to the site and checks its DNS straight away. The first domain becomes primary. */
export async function addDomainAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { site, siteId } = await requireManager(formData);
    const parsed = parseDomain(text(formData, "hostname"), {
      adminSubdomain: process.env.ADMIN_SUBDOMAIN?.trim() || "qubo",
      platformBase: process.env.PLATFORM_BASE_DOMAIN?.trim() || null,
    });
    if (!parsed.ok) return { error: parsed.error };

    const owner = await hostnameTaken(parsed.hostname);
    if (owner) return { error: owner === siteId ? "This domain is already connected to this site." : "This domain is connected to another site." };

    const existing = await db.select({ id: siteDomain.id }).from(siteDomain).where(eq(siteDomain.siteId, siteId));
    const limit = (await getAccess()).entitlements.limits.customDomainsPerSite;
    if (limit !== null && existing.length >= limit) {
      return { error: `Your plan covers ${limit} domain${limit === 1 ? "" : "s"} per site. Remove one or upgrade.` };
    }

    const [row] = await db
      .insert(siteDomain)
      .values({ siteId, hostname: parsed.hostname, isPrimary: existing.length === 0 })
      .onConflictDoNothing()
      .returning({ id: siteDomain.id });
    if (!row) return { error: "This domain is connected to another site." };
    await checkDomain(row.id).catch(() => null);
    return done(site.slug);
  } catch (e) {
    return fail(e);
  }
}

export async function checkDomainAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { site, siteId } = await requireSiteFromForm(formData);
    const row = await ownDomain(siteId, formData);
    if (!row.checkedAt || Date.now() - row.checkedAt.getTime() >= MIN_CHECK_GAP_MS) await checkDomain(row.id);
    return done(site.slug);
  } catch (e) {
    return fail(e);
  }
}

/** The primary domain is used in links, emails, canonical URLs and the sitemap. */
export async function makePrimaryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { site, siteId } = await requireManager(formData);
    const row = await ownDomain(siteId, formData);
    if (!row.verifiedAt) return { error: "Connect this domain before making it primary." };
    await db.transaction(async (tx) => {
      await tx.update(siteDomain).set({ isPrimary: false }).where(and(eq(siteDomain.siteId, siteId), ne(siteDomain.id, row.id)));
      await tx.update(siteDomain).set({ isPrimary: true }).where(eq(siteDomain.id, row.id));
    });
    return done(site.slug);
  } catch (e) {
    return fail(e);
  }
}

/** Stops serving the domain on the next edge poll. A removed primary hands over to the oldest remaining domain. */
export async function removeDomainAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { site, siteId } = await requireManager(formData);
    const row = await ownDomain(siteId, formData);
    await db.transaction(async (tx) => {
      await tx.delete(siteDomain).where(eq(siteDomain.id, row.id));
      if (!row.isPrimary) return;
      const rest = await tx.select({ id: siteDomain.id, verifiedAt: siteDomain.verifiedAt }).from(siteDomain).where(eq(siteDomain.siteId, siteId)).orderBy(asc(siteDomain.createdAt));
      const next = rest.find((d) => d.verifiedAt) ?? rest[0];
      if (next) await tx.update(siteDomain).set({ isPrimary: true }).where(eq(siteDomain.id, next.id));
    });
    return done(site.slug);
  } catch (e) {
    return fail(e);
  }
}

/** Invalidates the link handed to whoever manages the DNS. */
export async function regenerateShareLinkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { site, siteId } = await requireManager(formData);
    const row = await ownDomain(siteId, formData);
    await db.update(siteDomain).set({ shareToken: randomBytes(18).toString("base64url") }).where(eq(siteDomain.id, row.id));
    return done(site.slug);
  } catch (e) {
    return fail(e);
  }
}

/** Public share page: anyone holding the link may trigger a (rate-limited) check. */
export async function checkSharedDomainAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = text(formData, "token");
  const [row] = token ? await db.select().from(siteDomain).where(eq(siteDomain.shareToken, token)) : [];
  if (!row) return { error: "This link is no longer valid." };
  if (!row.checkedAt || Date.now() - row.checkedAt.getTime() >= MIN_CHECK_GAP_MS) await checkDomain(row.id).catch(() => null);
  revalidatePath(`/dns/${token}`);
  return { ok: true, at: Date.now() };
}
