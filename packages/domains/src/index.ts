/**
 * Custom domains, the pure half: what a domain needs in DNS, how to read what
 * DNS answered, and which provider the customer is talking to. No I/O here so
 * the admin, the public instructions page and tests share one source of truth.
 */
import { parse } from "tldts";

export const VERIFY_LABEL = "_qubo-verify";
export const PREVIEW_LABEL = "preview";

export type RecordId = "apex" | "www" | "admin" | "proof";
export type RecordType = "A" | "CNAME" | "TXT";
export type RecordStatus = "ok" | "missing" | "wrong" | "proxied" | "ipv6";

export type PlannedRecord = {
  id: RecordId;
  type: RecordType;
  /** Name as typed in a DNS panel, relative to the zone (`@` for the zone itself). */
  name: string;
  fqdn: string;
  value: string;
  required: boolean;
  purpose: string;
};

export type RecordCheck = { id: RecordId; status: RecordStatus; found: string[] };

export type DnsReport = {
  checkedAt: string;
  zone: string;
  nameservers: string[];
  provider: string | null;
  serverIps: string[];
  records: RecordCheck[];
  /** Every required record checks out: the domain can be verified. */
  ready: boolean;
  /** The resolver itself failed (timeout); statuses may be stale. */
  error?: string;
};

export type DomainParse = { ok: true; hostname: string; zone: string; isApex: boolean } | { ok: false; error: string };

/**
 * Accepts what people paste (`https://www.Example.be/shop`, `example.be.`,
 * `café.be`) and returns the bare ASCII hostname plus its registrable zone.
 */
export function parseDomain(input: string, opts: { adminSubdomain?: string; platformBase?: string | null } = {}): DomainParse {
  let raw = input.trim().toLowerCase();
  if (!raw) return { ok: false, error: "Type a domain, like example.be." };
  raw = raw.replace(/^[a-z]+:\/\//, "").split(/[/?#]/)[0]!.replace(/:\d+$/, "").replace(/\.$/, "");
  let host: string;
  try {
    host = new URL(`http://${raw}`).hostname;
  } catch {
    return { ok: false, error: "That doesn't look like a domain." };
  }
  host = host.replace(/^www\./, "");
  const info = parse(host, { allowPrivateDomains: true });
  if (info.isIp) return { ok: false, error: "Use a domain name, not an IP address." };
  if (!info.domain || !(info.isIcann || info.isPrivate) || host.length > 253) return { ok: false, error: "That isn't a domain you can register. Check the spelling." };
  const admin = (opts.adminSubdomain || "qubo").toLowerCase();
  if (host.startsWith(`${admin}.`) || host.startsWith(`${PREVIEW_LABEL}.`)) {
    return { ok: false, error: `${host.split(".")[0]}. is added for you. Connect the domain without it.` };
  }
  const base = opts.platformBase?.trim().toLowerCase();
  if (base && (host === base || host.endsWith(`.${base}`))) return { ok: false, error: "That address is provided by Qubo already." };
  return { ok: true, hostname: host, zone: info.domain, isApex: host === info.domain };
}

export const isApexHost = (hostname: string) => parse(hostname, { allowPrivateDomains: true }).domain === hostname;
export const zoneOf = (hostname: string) => parse(hostname, { allowPrivateDomains: true }).domain ?? hostname;

const relative = (fqdn: string, zone: string) => (fqdn === zone ? "@" : fqdn.slice(0, -(zone.length + 1)));

/** The records a domain needs. Address records are checked by resolving, so a CNAME that lands on our IP counts too. */
export function plannedRecords(input: { hostname: string; serverIps: string[]; token: string; adminSubdomain?: string }): PlannedRecord[] {
  const { hostname, token } = input;
  const zone = zoneOf(hostname);
  const admin = (input.adminSubdomain || "qubo").toLowerCase();
  const ip = input.serverIps.find((i) => i.includes(".")) ?? input.serverIps[0] ?? "YOUR.SERVER.IP";
  const records: PlannedRecord[] = [
    { id: "apex", type: "A", name: relative(hostname, zone), fqdn: hostname, value: ip, required: true, purpose: `Opens your site at ${hostname}` },
  ];
  if (hostname === zone) {
    records.push({ id: "www", type: "CNAME", name: relative(`www.${hostname}`, zone), fqdn: `www.${hostname}`, value: hostname, required: false, purpose: `Sends www.${hostname} to ${hostname}` });
  }
  records.push(
    { id: "admin", type: "CNAME", name: relative(`${admin}.${hostname}`, zone), fqdn: `${admin}.${hostname}`, value: hostname, required: false, purpose: `Opens Qubo at ${admin}.${hostname}` },
    { id: "proof", type: "TXT", name: relative(`${VERIFY_LABEL}.${hostname}`, zone), fqdn: `${VERIFY_LABEL}.${hostname}`, value: `qubo-verify=${token}`, required: true, purpose: "Proves the domain is yours" },
  );
  return records;
}

export type Lookups = {
  a: Record<string, string[]>;
  aaaa: Record<string, string[]>;
  txt: Record<string, string[]>;
};

// Cloudflare's published edge ranges (IPv4): a proxied ("orange cloud") record answers with these.
const CLOUDFLARE_V4 = ["173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22", "141.101.64.0/18", "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20", "197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13", "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22"];

const ipToInt = (ip: string) => ip.split(".").reduce((n, p) => (n << 8) + Number(p), 0) >>> 0;
export function isCloudflareIp(ip: string) {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return false;
  const n = ipToInt(ip);
  return CLOUDFLARE_V4.some((cidr) => {
    const [base, bits] = cidr.split("/");
    const mask = bits === "0" ? 0 : (~0 << (32 - Number(bits))) >>> 0;
    return (n & mask) === (ipToInt(base!) & mask);
  });
}

/** Turns raw answers into one status per record. Each record is judged on its own. */
export function evaluate(planned: PlannedRecord[], lookups: Lookups, serverIps: string[]): RecordCheck[] {
  const ours = new Set(serverIps);
  return planned.map((r) => {
    if (r.type === "TXT") {
      const found = lookups.txt[r.fqdn] ?? [];
      return { id: r.id, status: found.includes(r.value) ? "ok" : found.length ? "wrong" : "missing", found };
    }
    const v4 = lookups.a[r.fqdn] ?? [];
    const v6 = lookups.aaaa[r.fqdn] ?? [];
    const found = [...v4, ...v6];
    if (!v4.length) return { id: r.id, status: v6.length ? "wrong" : "missing", found };
    if (v4.some(isCloudflareIp) && !v4.some((ip) => ours.has(ip))) return { id: r.id, status: "proxied", found };
    if (!v4.every((ip) => ours.has(ip))) return { id: r.id, status: "wrong", found };
    // An AAAA pointing elsewhere sends IPv6 visitors to the old host.
    if (v6.some((ip) => !ours.has(ip))) return { id: r.id, status: "ipv6", found };
    return { id: r.id, status: "ok", found };
  });
}

export const isReady = (planned: PlannedRecord[], checks: RecordCheck[]) =>
  planned.filter((r) => r.required).every((r) => checks.find((c) => c.id === r.id)?.status === "ok");

export type DnsProvider = {
  id: string;
  name: string;
  /** Where the DNS records live, in the provider's own words. */
  where: string;
  url: string;
  note?: string;
};

const PROVIDERS: (DnsProvider & { ns: string[] })[] = [
  { id: "cloudflare", name: "Cloudflare", ns: ["ns.cloudflare.com"], where: "your domain → DNS → Records", url: "https://dash.cloudflare.com/", note: "Set Proxy status to “DNS only” (grey cloud) on these records, otherwise we can't see your server or issue its certificate." },
  { id: "combell", name: "Combell", ns: ["combell.net", "combell.com"], where: "My Combell → DNS & forwarding → Manage DNS records", url: "https://my.combell.com/" },
  { id: "ovh", name: "OVHcloud", ns: ["ovh.net", "ovh.ca", "anycast.me"], where: "Web Cloud → Domain names → your domain → DNS zone", url: "https://www.ovh.com/manager/" },
  { id: "one", name: "one.com", ns: ["one.com"], where: "Control panel → Advanced settings → DNS settings", url: "https://www.one.com/admin/" },
  { id: "versio", name: "Versio", ns: ["versio.nl", "versio.be"], where: "Domains → your domain → DNS management", url: "https://www.versio.be/customer/" },
  { id: "transip", name: "TransIP", ns: ["transip.net", "transip.nl", "transip.eu"], where: "Domains → your domain → DNS", url: "https://www.transip.be/cp/" },
  { id: "vimexx", name: "Vimexx", ns: ["vimexx.nl", "vimexx.be"], where: "Domain names → your domain → DNS settings", url: "https://my.vimexx.be/" },
  { id: "hostinger", name: "Hostinger", ns: ["dns-parking.com", "hostinger.com"], where: "Domains → your domain → DNS / Nameservers", url: "https://hpanel.hostinger.com/" },
  { id: "godaddy", name: "GoDaddy", ns: ["domaincontrol.com"], where: "My Products → your domain → DNS", url: "https://dcc.godaddy.com/" },
  { id: "namecheap", name: "Namecheap", ns: ["registrar-servers.com"], where: "Domain List → Manage → Advanced DNS", url: "https://ap.www.namecheap.com/" },
  { id: "ionos", name: "IONOS", ns: ["ui-dns.com", "ui-dns.de", "ui-dns.org", "ui-dns.biz"], where: "Domains & SSL → your domain → DNS", url: "https://my.ionos.com/" },
  { id: "gandi", name: "Gandi", ns: ["gandi.net"], where: "Domains → your domain → DNS records", url: "https://admin.gandi.net/" },
  { id: "strato", name: "STRATO", ns: ["stratoserver.net", "strato.de"], where: "Domains → Manage domain → DNS", url: "https://www.strato.de/apps/CustomerService" },
  { id: "squarespace", name: "Squarespace Domains", ns: ["googledomains.com", "squarespacedns.com"], where: "Domains → your domain → DNS → Custom records", url: "https://account.squarespace.com/domains" },
  { id: "wix", name: "Wix", ns: ["wixdns.net"], where: "Domains → your domain → Manage DNS records", url: "https://manage.wix.com/account/domains" },
  { id: "hetzner", name: "Hetzner", ns: ["hetzner.com", "hetzner.de", "your-server.de", "second-ns.com"], where: "DNS Console → your zone", url: "https://dns.hetzner.com/" },
  { id: "digitalocean", name: "DigitalOcean", ns: ["digitalocean.com"], where: "Networking → Domains → your domain", url: "https://cloud.digitalocean.com/networking/domains" },
  { id: "route53", name: "Amazon Route 53", ns: ["awsdns"], where: "Hosted zones → your domain", url: "https://console.aws.amazon.com/route53/" },
  { id: "vercel", name: "Vercel", ns: ["vercel-dns.com"], where: "Domains → your domain → DNS records", url: "https://vercel.com/dashboard/domains" },
  { id: "netlify", name: "Netlify", ns: ["nsone.net"], where: "Domains → your domain → DNS settings", url: "https://app.netlify.com/teams/-/dns" },
];

/** Which DNS host answers for the zone, from its nameservers. Null = unknown, show the generic guide. */
export function detectProvider(nameservers: string[]): DnsProvider | null {
  for (const ns of nameservers.map((n) => n.toLowerCase().replace(/\.$/, ""))) {
    const hit = PROVIDERS.find((p) => p.ns.some((s) => ns === s || ns.endsWith(`.${s}`) || (s === "awsdns" && ns.includes("awsdns"))));
    if (hit) {
      const { ns: _ns, ...provider } = hit;
      return provider;
    }
  }
  return null;
}

export const providerById = (id: string | null) => {
  const hit = PROVIDERS.find((p) => p.id === id);
  if (!hit) return null;
  const { ns: _ns, ...provider } = hit;
  return provider as DnsProvider;
};

/**
 * Install-day admin address before any domain exists: `qubo.203-0-113-7.sslip.io`
 * resolves to the IP inside it, so the edge can get a real certificate for it.
 */
export function fallbackAdminHost(ip: string, adminSubdomain = "qubo") {
  return /^\d+\.\d+\.\d+\.\d+$/.test(ip) ? `${adminSubdomain}.${ip.replaceAll(".", "-")}.sslip.io` : null;
}

/** Check cadence: eager while someone is likely editing DNS, then backing off; verified domains every 6 h. */
export function nextCheckDelayMs(createdAt: Date, verified: boolean, now = new Date()) {
  if (verified) return 6 * 3600_000;
  const age = now.getTime() - createdAt.getTime();
  if (age < 15 * 60_000) return 30_000;
  if (age < 24 * 3600_000) return 5 * 60_000;
  if (age < 7 * 24 * 3600_000) return 3600_000;
  return 12 * 3600_000;
}

/** One-line summary for lists: "Connected", "2 of 4 records", ... */
export function summarise(report: DnsReport | null, verified: boolean) {
  if (!report) return { tone: "pending" as const, label: verified ? "Connected" : "Not checked yet" };
  const ok = report.records.filter((r) => r.status === "ok").length;
  const attention = report.records.some((r) => r.status === "wrong" || r.status === "proxied" || r.status === "ipv6");
  if (verified) return ok === report.records.length ? { tone: "ok" as const, label: "Connected" } : { tone: "warn" as const, label: `Connected · ${report.records.length - ok} record${report.records.length - ok === 1 ? "" : "s"} to fix` };
  return { tone: attention ? ("warn" as const) : ("pending" as const), label: `${ok} of ${report.records.length} records` };
}
