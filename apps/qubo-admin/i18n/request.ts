import { db } from "@qubo/db/client";
import { user } from "@qubo/db/schema";
import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { auth } from "@/lib/auth";
import { fromAcceptLanguage, isLocale, LOCALE_COOKIE, type AdminLocale } from "./config";

/** Cookie first (fast), then the language saved on the account, then the browser's. */
async function resolveLocale(): Promise<AdminLocale> {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  const h = await headers();
  try {
    const session = await auth.api.getSession({ headers: h });
    if (session?.user) {
      const [row] = await db.select({ locale: user.locale }).from(user).where(eq(user.id, session.user.id)).limit(1);
      if (isLocale(row?.locale)) return row.locale;
    }
  } catch {
    // Signed-out or database hiccup: fall through to the browser language.
  }
  return fromAcceptLanguage(h.get("accept-language"));
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  // Pinned so next-intl does not warn about environment-dependent markup.
  return { locale, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, messages: (await import(`../messages/${locale}`)).default };
});
