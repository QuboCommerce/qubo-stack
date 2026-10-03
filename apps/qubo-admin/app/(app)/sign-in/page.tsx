import { cookies, headers } from "next/headers";
import { SignInForm } from "@/components/sign-in-form";
import { siteForAdminHost } from "@/lib/admin-host";
import { ago } from "@/lib/relative";
import { cookieToken, endedNotice } from "@/lib/sessions";

type Props = { searchParams: Promise<{ email?: string }> };

export default async function SignInPage({ searchParams }: Props) {
  const [{ email }, h, jar] = await Promise.all([searchParams, headers(), cookies()]);
  // A dead cookie from a session that was ended on purpose: say why (offline tab case).
  const token = cookieToken((n) => jar.get(n)?.value);
  const ended = token ? await endedNotice(token).catch(() => null) : null;
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0]!.trim();
  const site = host ? await siteForAdminHost(host).catch(() => null) : null;
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <section className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">{site?.name ?? "Qubo"}</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Connectez-vous au panneau d’administration.
        </p>
        {ended && (
          <div role="status" className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <p className="font-medium">{ended.reason === "takeover" ? "You have been logged in elsewhere" : "This device was signed out"}</p>
            <p className="mt-0.5 text-muted-foreground">
              {[ended.deviceLabel, ended.place, ended.endedAt ? ago(ended.endedAt) : null].filter(Boolean).join(" · ")}
            </p>
          </div>
        )}
        <SignInForm email={typeof email === "string" ? email.slice(0, 254) : undefined} />
      </section>
    </main>
  );
}
