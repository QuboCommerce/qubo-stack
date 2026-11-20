"use server";

import { db } from "@qubo/db/client";
import { user } from "@qubo/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/admin";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";

/** Saves the panel language on the account and in a cookie so the next render picks it up. */
export async function setLanguage(locale: string) {
  if (!isLocale(locale)) return;
  const me = await requireUser();
  await db.update(user).set({ locale }).where(eq(user.id, me.id));
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
