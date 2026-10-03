import { headers } from "next/headers";
import { SignInForm } from "@/components/sign-in-form";
import { siteForAdminHost } from "@/lib/admin-host";

type Props = { searchParams: Promise<{ email?: string }> };

export default async function SignInPage({ searchParams }: Props) {
  const [{ email }, h] = await Promise.all([searchParams, headers()]);
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0]!.trim();
  const site = host ? await siteForAdminHost(host).catch(() => null) : null;
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <section className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">{site?.name ?? "Qubo"}</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Connectez-vous au panneau d’administration.
        </p>
        <SignInForm email={typeof email === "string" ? email.slice(0, 254) : undefined} />
      </section>
    </main>
  );
}
