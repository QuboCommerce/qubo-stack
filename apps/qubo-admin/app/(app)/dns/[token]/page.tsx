import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Globe } from "lucide-react";
import { db } from "@qubo/db/client";
import { siteDomain } from "@qubo/db/schema";
import { checkDomain } from "@qubo/domains/server";
import { DnsSetup } from "@/components/settings/domains/dns-setup";
import { AutoRefresh } from "@/components/settings/domains/auto-refresh";
import { domainContext, domainView } from "@/lib/domains";

export const metadata: Metadata = { title: "DNS setup", robots: { index: false, follow: false } };

/** While someone has this page open, DNS is re-checked at most this often. */
const LIVE_CHECK_MS = 30_000;

/**
 * Login-free DNS guide for whoever manages the domain (a web agency, the
 * registrar's support desk). The token is the only key; it shows the records
 * and their status for one domain and nothing else about the site.
 */
export default async function SharedDnsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let [row] = await db.select().from(siteDomain).where(eq(siteDomain.shareToken, token));
  if (!row) notFound();
  if (!row.verifiedAt && (!row.checkedAt || Date.now() - row.checkedAt.getTime() > LIVE_CHECK_MS)) {
    row = (await checkDomain(row.id).catch(() => null)) ?? row;
  }
  const ctx = await domainContext();
  const domain = domainView(row, ctx.ips);

  return (
    <main className="min-h-dvh bg-muted/40 px-4 py-10 sm:py-16">
      <AutoRefresh everyMs={domain.verified ? 0 : 15_000} />
      <div className="mx-auto grid max-w-2xl gap-6">
        <header className="grid gap-2">
          <span className="text-[12px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">Qubo · DNS setup</span>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Globe className="size-5 text-muted-foreground" /> {domain.hostname}
          </h1>
          <p className="text-sm text-muted-foreground">
            The owner of this domain asked you to add a few DNS records. Each one turns green as soon as it is visible on the internet.
          </p>
        </header>
        <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-black/5 sm:p-6 dark:ring-white/10">
          <DnsSetup domain={domain} shareToken={token} />
        </div>
      </div>
    </main>
  );
}
