/**
 * Local IP geolocation and device labels. Lookups read a DB-IP Lite City mmdb
 * from disk (`pnpm --filter @qubo/geo update`); nothing leaves the server.
 * Attribution required in the UI: "IP geolocation by DB-IP".
 */
import { readFileSync, statSync } from "node:fs";
import { isIP } from "node:net";
import { resolve } from "node:path";
import { Reader, type CityResponse } from "mmdb-lib";

export const GEO_ATTRIBUTION = { label: "IP geolocation by DB-IP", url: "https://db-ip.com" } as const;

export type Geo = {
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  lat: number | null;
  lng: number | null;
  /** Private, loopback or link-local address: show "this network". */
  local?: boolean;
};

type CityRecord = CityResponse;

const EMPTY: Geo = { city: null, region: null, country: null, countryCode: null, lat: null, lng: null };

let cached: { path: string; mtime: number; reader: Reader<CityRecord> } | null = null;

function dbPath() {
  return resolve(process.env.QUBO_GEO_DB ?? `${process.cwd()}/../../.private/geo/dbip-city-lite.mmdb`);
}

/** Opens (and re-opens after an update) the mmdb; null when it isn't installed. */
function reader(): Reader<CityRecord> | null {
  const path = dbPath();
  let mtime: number;
  try { mtime = statSync(path).mtimeMs; } catch { return null; }
  if (cached && cached.path === path && cached.mtime === mtime) return cached.reader;
  cached = { path, mtime, reader: new Reader<CityRecord>(readFileSync(path)) };
  return cached.reader;
}

export function isPrivateIp(ip: string) {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number) as [number, number];
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127) || a === 0;
  }
  if (v === 6) {
    const l = ip.toLowerCase();
    if (l.startsWith("::ffff:")) return isPrivateIp(l.slice(7));
    return l === "::1" || l === "::" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80");
  }
  return false;
}

/** Best-effort lookup; never throws. Unknown IPs and a missing database give nulls. */
export function lookup(ip: string | null | undefined, locale = "en"): Geo {
  if (!ip) return EMPTY;
  const clean = ip.trim().replace(/^::ffff:(?=\d+\.)/, "");
  if (!isIP(clean)) return EMPTY;
  if (isPrivateIp(clean)) return { ...EMPTY, local: true };
  try {
    const r = reader()?.get(clean);
    if (!r) return EMPTY;
    const name = (n?: object) => ((n as Record<string, string> | undefined)?.[locale] ?? (n as Record<string, string> | undefined)?.en ?? null);
    return {
      city: name(r.city?.names),
      region: name(r.subdivisions?.[0]?.names),
      country: name(r.country?.names),
      countryCode: r.country?.iso_code ?? null,
      lat: r.location?.latitude ?? null,
      lng: r.location?.longitude ?? null,
    };
  } catch {
    return EMPTY;
  }
}

/** "Brussels, Belgium" / "this network" / null. */
export function placeLabel(g: Pick<Geo, "city" | "country" | "local">) {
  if (g.local) return "this network";
  return [g.city, g.country].filter(Boolean).join(", ") || null;
}

/** 🇧🇪 from "BE". */
export const flag = (cc: string | null | undefined) =>
  cc && /^[A-Z]{2}$/i.test(cc) ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "";

export type Device = { browser: string | null; os: string | null; label: string };

/** Small UA classifier for labels like "Chrome · Windows" (no dependency, good enough for humans). */
export function parseUserAgent(ua: string | null | undefined): Device {
  const s = ua ?? "";
  const browser =
    /Edg(e|A|iOS)?\//.test(s) ? "Edge"
    : /OPR\/|Opera/.test(s) ? "Opera"
    : /SamsungBrowser\//.test(s) ? "Samsung Internet"
    : /Firefox\/|FxiOS\//.test(s) ? "Firefox"
    : /Chrome\/|CriOS\//.test(s) ? "Chrome"
    : /Safari\//.test(s) && /Version\//.test(s) ? "Safari"
    : /curl\//.test(s) ? "curl"
    : null;
  const os =
    /iPhone|iPod/.test(s) ? "iPhone"
    : /iPad/.test(s) ? "iPad"
    : /Android/.test(s) ? "Android"
    : /Windows/.test(s) ? "Windows"
    : /Mac OS X|Macintosh/.test(s) ? "macOS"
    : /CrOS/.test(s) ? "ChromeOS"
    : /Linux/.test(s) ? "Linux"
    : null;
  return { browser, os, label: [browser ?? "Unknown browser", os].filter(Boolean).join(" · ") };
}

/** Client IP from proxy headers. Only meaningful behind a trusted proxy (Traefik/Caddy set these). */
export function clientIp(headers: Headers): string | null {
  const real = headers.get("x-real-ip")?.trim();
  if (real && isIP(real)) return real;
  const xff = headers.get("x-forwarded-for")?.split(",").map((p) => p.trim()).filter((p) => isIP(p));
  return xff?.length ? xff[0]! : null;
}
