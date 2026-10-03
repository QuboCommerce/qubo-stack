import { expect, test } from "bun:test";
import { flag, isPrivateIp, lookup, parseUserAgent, placeLabel } from "./index";

test("private ranges", () => {
  for (const ip of ["10.1.2.3", "192.168.1.5", "172.20.0.1", "127.0.0.1", "::1", "fd00::1", "::ffff:192.168.0.1"]) expect(isPrivateIp(ip)).toBe(true);
  for (const ip of ["8.8.8.8", "172.32.0.1", "2a02:a03f::1"]) expect(isPrivateIp(ip)).toBe(false);
  expect(placeLabel(lookup("192.168.1.5"))).toBe("this network");
});

test("bad input never throws", () => {
  expect(lookup("not an ip").city).toBeNull();
  expect(lookup(null).country).toBeNull();
});

test("user agents", () => {
  expect(parseUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36").label).toBe("Chrome · Windows");
  expect(parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1").label).toBe("Safari · iPhone");
  expect(parseUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Gecko/20100101 Firefox/131.0").label).toBe("Firefox · macOS");
  expect(parseUserAgent("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0").browser).toBe("Edge");
});

test("flags", () => expect(flag("be")).toBe("🇧🇪"));

test.if(lookup("8.8.8.8").country !== null)("real lookup (needs the mmdb)", () => {
  expect(lookup("8.8.8.8").countryCode).toBe("US");
});
