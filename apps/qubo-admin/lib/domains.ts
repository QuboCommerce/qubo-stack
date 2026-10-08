import "server-only";
import { headers } from "next/headers";
import type { siteDomain } from "@qubo/db/schema";
import { fallbackAdminHost, plannedRecords, providerById, summarise, type DnsProvider, type DnsReport, type PlannedRecord, type RecordStatus } from "@qubo/domains";
import { serverIps } from "@qubo/domains/server";

export type DomainRecordView = PlannedRecord & { status: RecordStatus | "unknown"; found: string[] };

/** Everything the domains UI needs about one domain, serialisable for client components. */
export type DomainView = {
  id: string;
  hostname: string;
  isPrimary: boolean;
  verified: boolean;
  checkedAt: string | null;
  records: DomainRecordView[];
  provider: DnsProvider | null;
  nameservers: string[];
  summary: ReturnType<typeof summarise>;
  error: string | null;
  sharePath: string;
};

const adminSubdomain = () => (process.env.ADMIN_SUBDOMAIN?.trim() || "qubo").toLowerCase();

export function domainView(row: typeof siteDomain.$inferSelect, ips: string[]): DomainView {
  const report = row.dns as DnsReport | null;
  const planned = plannedRecords({ hostname: row.hostname, serverIps: ips, token: row.verifyToken, adminSubdomain: adminSubdomain() });
  return {
    id: row.id,
    hostname: row.hostname,
    isPrimary: row.isPrimary,
    verified: row.verifiedAt !== null,
    checkedAt: row.checkedAt?.toISOString() ?? null,
    records: planned.map((r) => {
      const check = report?.records.find((c) => c.id === r.id);
      return { ...r, status: check?.status ?? "unknown", found: check?.found ?? [] };
    }),
    provider: providerById(report?.provider ?? null),
    nameservers: report?.nameservers ?? [],
    summary: summarise(report, row.verifiedAt !== null),
    error: report?.error ?? null,
    sharePath: `/dns/${row.shareToken}`,
  };
}

/** Public IPs plus the origin the share link is built on (the host the admin is being used from). */
export async function domainContext() {
  const [ips, h] = await Promise.all([serverIps().catch(() => [] as string[]), headers()]);
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const ipv4 = ips.find((i) => i.includes("."));
  return { ips, origin: host ? `${proto}://${host}` : "", fallbackAdmin: ipv4 ? fallbackAdminHost(ipv4, adminSubdomain()) : null };
}
