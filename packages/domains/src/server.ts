/**
 * Custom domains, the I/O half: DNS lookups against public resolvers, the
 * verification sweep, and the dynamic config Traefik polls to route and
 * certify every verified host.
 */
import { Resolver } from "node:dns/promises";
import { isIP } from "node:net";
import { and, asc, eq, isNotNull, isNull, lte } from "drizzle-orm";
import { db, sql as pg } from "@qubo/db/client";
import { site, siteDomain } from "@qubo/db/schema";
import { publish } from "@qubo/realtime/server";
import {
  detectProvider,
  evaluate,
  fallbackAdminHost,
  isApexHost,
  isReady,
  nextCheckDelayMs,
  plannedRecords,
  PREVIEW_LABEL,
  zoneOf,
  type DnsReport,
  type Lookups,
} from "./index";

const adminSubdomain = () => (process.env.ADMIN_SUBDOMAIN?.trim() || "qubo").toLowerCase();

let resolver: Resolver | null = null;
function dns() {
  if (resolver) return resolver;
  // Public resolvers, not the box's own: a local cache or split-horizon DNS would lie about what visitors see.
  resolver = new Resolver({ timeout: 3000, tries: 2 });
  const servers = (process.env.QUBO_DNS_SERVERS ?? "1.1.1.1,8.8.8.8").split(",").map((s) => s.trim()).filter(Boolean);
  resolver.setServers(servers);
  return resolver;
}

const EMPTY = new Set(["ENODATA", "ENOTFOUND", "ESERVFAIL", "NXDOMAIN", "ENONAME"]);
async function answer<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch (e) {
    if (EMPTY.has((e as NodeJS.ErrnoException).code ?? "")) return [];
    throw e;
  }
}

let ipCache: { at: number; ips: string[] } | null = null;

/**
 * The public address(es) visitors must reach. `QUBO_SERVER_IP` wins (comma list,
 * v4 and/or v6); otherwise the instance's own public host is resolved, which keeps
 * a DDNS box such as the dev server right without configuration.
 */
export async function serverIps(): Promise<string[]> {
  const fixed = (process.env.QUBO_SERVER_IP ?? "").split(",").map((s) => s.trim()).filter((s) => isIP(s));
  if (fixed.length) return fixed;
  if (ipCache && Date.now() - ipCache.at < 5 * 60_000) return ipCache.ips;
  let host: string | null = null;
  for (const url of [process.env.QUBO_PUBLIC_URL, process.env.BETTER_AUTH_URL]) {
    try {
      if (url) host = new URL(url).hostname;
    } catch {}
    if (host) break;
  }
  let ips: string[] = [];
  if (host && isIP(host)) ips = [host];
  else if (host && host !== "localhost" && !host.endsWith(".localhost")) ips = await answer(() => dns().resolve4(host)).catch(() => []);
  ipCache = { at: Date.now(), ips };
  return ips;
}

/** Looks every planned name up and grades it. Never throws: resolver failures land in `report.error`. */
export async function inspect(hostname: string, token: string): Promise<DnsReport> {
  const ips = await serverIps();
  const planned = plannedRecords({ hostname, serverIps: ips, token, adminSubdomain: adminSubdomain() });
  const lookups: Lookups = { a: {}, aaaa: {}, txt: {} };
  const zone = zoneOf(hostname);
  let nameservers: string[] = [];
  let error: string | undefined;
  try {
    const r = dns();
    await Promise.all([
      answer(() => r.resolveNs(zone)).then((ns) => (nameservers = ns.map((n) => n.toLowerCase()).sort())),
      ...planned.map(async (p) => {
        if (p.type === "TXT") lookups.txt[p.fqdn] = (await answer(() => r.resolveTxt(p.fqdn))).map((chunks) => chunks.join(""));
        else {
          const [v4, v6] = await Promise.all([answer(() => r.resolve4(p.fqdn)), answer(() => r.resolve6(p.fqdn))]);
          lookups.a[p.fqdn] = v4;
          lookups.aaaa[p.fqdn] = v6;
        }
      }),
    ]);
  } catch (e) {
    error = (e as NodeJS.ErrnoException).code ?? (e as Error).message;
  }
  const records = evaluate(planned, lookups, ips);
  return {
    checkedAt: new Date().toISOString(),
    zone,
    nameservers,
    provider: detectProvider(nameservers)?.id ?? null,
    serverIps: ips,
    records,
    ready: !error && ips.length > 0 && isReady(planned, records),
    ...(error ? { error } : {}),
  };
}

const signature = (r: DnsReport | null) => (r ? r.records.map((c) => `${c.id}:${c.status}`).join(",") : "");

/**
 * Checks one domain, stores the report and schedules the next check. The first
 * time the required records hold, the domain is verified and the edge picks it
 * up on its next poll. A later failure is reported but never un-verifies: a DNS
 * hiccup must not take a live shop offline.
 */
export async function checkDomain(id: string) {
  const [row] = await db.select().from(siteDomain).where(eq(siteDomain.id, id));
  if (!row) return null;
  const report = await inspect(row.hostname, row.verifyToken);
  const now = new Date();
  const verifiedAt = row.verifiedAt ?? (report.ready ? now : null);
  const delay = report.error ? 60_000 : nextCheckDelayMs(row.createdAt, verifiedAt !== null, now);
  await db
    .update(siteDomain)
    .set({ dns: report, checkedAt: now, nextCheckAt: new Date(now.getTime() + delay), verifiedAt })
    .where(eq(siteDomain.id, id));
  const changed = signature(row.dns as DnsReport | null) !== signature(report) || (!row.verifiedAt && verifiedAt);
  if (changed) await publish(pg, { type: "site.domain.changed", siteId: row.siteId, payload: { hostname: row.hostname } }).catch(() => {});
  return { ...row, dns: report, checkedAt: now, verifiedAt };
}

/** One sweep: every domain whose check is due, a few at a time. */
export async function checkDue(limit = 20) {
  const due = await db
    .select({ id: siteDomain.id })
    .from(siteDomain)
    .where(lte(siteDomain.nextCheckAt, new Date()))
    .orderBy(asc(siteDomain.nextCheckAt))
    .limit(limit);
  let i = 0;
  const worker = async () => {
    while (i < due.length) {
      const { id } = due[i++]!;
      await checkDomain(id).catch((e) => console.error("[domains] check failed", id, e));
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return due.length;
}

type Router = { rule: string; entryPoints: string[]; service: string; tls?: { certResolver: string }; middlewares?: string[]; priority?: number };

/** Every host this instance answers for, with the app behind it. */
export async function servedHosts() {
  const admin = adminSubdomain();
  const verified = await db
    .select({ hostname: siteDomain.hostname })
    .from(siteDomain)
    .innerJoin(site, eq(site.id, siteDomain.siteId))
    .where(and(isNotNull(siteDomain.verifiedAt), isNull(site.deletedAt)));
  const hosts: { host: string; app: "admin" | "storefront"; redirectToApex?: boolean }[] = [];
  for (const { hostname } of verified) {
    hosts.push({ host: hostname, app: "storefront" }, { host: `${admin}.${hostname}`, app: "admin" }, { host: `${PREVIEW_LABEL}.${hostname}`, app: "storefront" });
    if (isApexHost(hostname)) hosts.push({ host: `www.${hostname}`, app: "storefront", redirectToApex: true });
  }
  const base = process.env.PLATFORM_BASE_DOMAIN?.trim().toLowerCase();
  if (base && process.env.QUBO_EDGE_PLATFORM !== "0") {
    const sites = await db.select({ slug: site.slug }).from(site).where(isNull(site.deletedAt));
    for (const { slug } of sites) hosts.push({ host: `${slug}.${base}`, app: "storefront" }, { host: `${slug}.${PREVIEW_LABEL}.${base}`, app: "storefront" });
  }
  // Install day: the admin is reachable on the server's IP via sslip.io until the first domain is verified.
  if (!verified.length) {
    for (const ip of await serverIps()) {
      const h = fallbackAdminHost(ip, admin);
      if (h) hosts.push({ host: h, app: "admin" });
    }
  }
  return hosts;
}

const routerName = (host: string) => `qubo-${host.replace(/[^a-z0-9]+/g, "-")}`;

/**
 * Traefik dynamic configuration (HTTP provider). One router per host so one
 * domain with broken DNS can't block the certificate of the others. Upstreams,
 * entry points and the resolver match Coolify's defaults and are overridable.
 */
export async function traefikConfig() {
  const env = process.env;
  const https = env.QUBO_EDGE_ENTRYPOINT_HTTPS || "https";
  const http = env.QUBO_EDGE_ENTRYPOINT_HTTP || "http";
  const certResolver = env.QUBO_EDGE_CERT_RESOLVER || "letsencrypt";
  const routers: Record<string, Router> = {};
  for (const { host, app, redirectToApex } of await servedHosts()) {
    const name = routerName(host);
    const service = `qubo-${app}`;
    const rule = `Host(\`${host}\`)`;
    routers[name] = { rule, entryPoints: [https], service, tls: { certResolver }, ...(redirectToApex ? { middlewares: ["qubo-www-to-apex"] } : {}) };
    routers[`${name}-http`] = { rule, entryPoints: [http], service, middlewares: ["qubo-to-https"] };
  }
  return {
    http: {
      routers,
      middlewares: {
        "qubo-to-https": { redirectScheme: { scheme: "https", permanent: true } },
        "qubo-www-to-apex": { redirectRegex: { regex: "^https?://www\\.(.+)", replacement: "https://${1}", permanent: true } },
      },
      services: {
        "qubo-admin": { loadBalancer: { servers: [{ url: env.QUBO_EDGE_ADMIN_URL || "http://qubo-admin:4000" }] } },
        "qubo-storefront": { loadBalancer: { servers: [{ url: env.QUBO_EDGE_STOREFRONT_URL || "http://qubo-storefront:3000" }] } },
      },
    },
  };
}

/** Domains a site has, verified or not; used to block duplicates across sites. */
export async function hostnameTaken(hostname: string) {
  const [row] = await db.select({ siteId: siteDomain.siteId }).from(siteDomain).where(and(eq(siteDomain.hostname, hostname)));
  return row?.siteId ?? null;
}
