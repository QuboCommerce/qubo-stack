import { describe, expect, it } from "vitest";
import { FREE_LIMITS } from "@qubo/protocol";
import { entitlementsFor, type PortalLink } from "../src";

const claims = (exp: number) => ({
  iss: "portal", sub: "ins_1", organizationId: "org_1", plan: "growth", iat: exp - 100, exp, grace: 7 * 86400,
  limits: { sitesPerOrg: 10, instances: 8, seats: 15, customDomainsPerSite: null, cubiclesPerSite: 25 }, features: ["ai"],
});
const linkWith = (licenseClaims: unknown) => ({ instanceId: "ins_1", licenseClaims }) as unknown as PortalLink;

describe("entitlementsFor", () => {
  it("unlinked = Free", () => {
    expect(entitlementsFor(null)).toMatchObject({ source: "unlinked", plan: "free", limits: FREE_LIMITS });
  });
  it("valid licence", () => {
    expect(entitlementsFor(linkWith(claims(1000)), 900)).toMatchObject({ source: "licence", plan: "growth", limits: { sitesPerOrg: 10 } });
  });
  it("keeps plan limits during grace", () => {
    expect(entitlementsFor(linkWith(claims(1000)), 1000 + 3 * 86400)).toMatchObject({ source: "grace", limits: { sitesPerOrg: 10 } });
  });
  it("falls back to Free after grace, never below", () => {
    expect(entitlementsFor(linkWith(claims(1000)), 1000 + 8 * 86400)).toMatchObject({ source: "expired", plan: "free", limits: FREE_LIMITS });
  });
  it("garbage claims = Free", () => {
    expect(entitlementsFor(linkWith({ nope: 1 }))).toMatchObject({ source: "expired", limits: FREE_LIMITS });
  });
});
