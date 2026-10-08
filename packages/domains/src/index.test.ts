import { describe, expect, test } from "bun:test";
import { detectProvider, evaluate, fallbackAdminHost, isCloudflareIp, nextCheckDelayMs, parseDomain, plannedRecords } from "./index";

describe("parseDomain", () => {
  test("cleans what people paste", () => {
    expect(parseDomain("https://WWW.HMFroid.be/shop?x=1")).toEqual({ ok: true, hostname: "hmfroid.be", zone: "hmfroid.be", isApex: true });
    expect(parseDomain("shop.example.co.uk.")).toEqual({ ok: true, hostname: "shop.example.co.uk", zone: "example.co.uk", isApex: false });
    expect(parseDomain("café.be")).toMatchObject({ ok: true, hostname: "xn--caf-dma.be" });
  });
  test("rejects what can't work", () => {
    expect(parseDomain("1.2.3.4").ok).toBe(false);
    expect(parseDomain("co.uk").ok).toBe(false);
    expect(parseDomain("localhost").ok).toBe(false);
    expect(parseDomain("qubo.hmfroid.be").ok).toBe(false);
    expect(parseDomain("preview.hmfroid.be").ok).toBe(false);
    expect(parseDomain("shop.dev.by-ali.dev", { platformBase: "dev.by-ali.dev" }).ok).toBe(false);
  });
});

describe("plannedRecords", () => {
  test("apex gets www; names are relative to the zone", () => {
    const r = plannedRecords({ hostname: "hmfroid.be", serverIps: ["203.0.113.7"], token: "abc" });
    expect(r.map((x) => [x.id, x.type, x.name, x.value])).toEqual([
      ["apex", "A", "@", "203.0.113.7"],
      ["www", "CNAME", "www", "hmfroid.be"],
      ["admin", "CNAME", "qubo", "hmfroid.be"],
      ["proof", "TXT", "_qubo-verify", "qubo-verify=abc"],
    ]);
  });
  test("subdomain skips www", () => {
    const r = plannedRecords({ hostname: "shop.example.be", serverIps: ["203.0.113.7"], token: "t" });
    expect(r.map((x) => x.name)).toEqual(["shop", "qubo.shop", "_qubo-verify.shop"]);
  });
});

describe("evaluate", () => {
  const planned = plannedRecords({ hostname: "x.be", serverIps: ["203.0.113.7"], token: "t" });
  const ours = ["203.0.113.7"];
  test("each record on its own", () => {
    const checks = evaluate(planned, {
      a: { "x.be": ["203.0.113.7"], "www.x.be": ["104.16.1.1"], "qubo.x.be": ["198.51.100.1"] },
      aaaa: { "x.be": ["2001:db8::1"] },
      txt: { "_qubo-verify.x.be": ["qubo-verify=other"] },
    }, ours);
    expect(checks.map((c) => c.status)).toEqual(["ipv6", "proxied", "wrong", "wrong"]);
  });
  test("all good", () => {
    const checks = evaluate(planned, { a: { "x.be": ours, "www.x.be": ours, "qubo.x.be": ours }, aaaa: {}, txt: { "_qubo-verify.x.be": ["v=spf1", "qubo-verify=t"] } }, ours);
    expect(checks.every((c) => c.status === "ok")).toBe(true);
  });
  test("missing", () => {
    expect(evaluate(planned, { a: {}, aaaa: {}, txt: {} }, ours).every((c) => c.status === "missing")).toBe(true);
  });
});

test("providers, cloudflare, fallback host, cadence", () => {
  expect(detectProvider(["ns1.combell.net."])?.name).toBe("Combell");
  expect(detectProvider(["dns200.anycast.me"])?.id).toBe("ovh");
  expect(detectProvider(["ns-123.awsdns-15.com"])?.id).toBe("route53");
  expect(detectProvider(["ns1.example.org"])).toBeNull();
  expect(isCloudflareIp("172.67.3.4")).toBe(true);
  expect(isCloudflareIp("8.8.8.8")).toBe(false);
  expect(fallbackAdminHost("203.0.113.7")).toBe("qubo.203-0-113-7.sslip.io");
  expect(fallbackAdminHost("2001:db8::1")).toBeNull();
  const now = new Date("2026-01-01T12:00:00Z");
  expect(nextCheckDelayMs(new Date(now.getTime() - 60_000), false, now)).toBe(30_000);
  expect(nextCheckDelayMs(new Date(now.getTime() - 3600_000), false, now)).toBe(300_000);
  expect(nextCheckDelayMs(now, true, now)).toBe(6 * 3600_000);
});
