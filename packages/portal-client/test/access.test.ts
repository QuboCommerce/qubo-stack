import { describe, expect, it } from "vitest";
import { FREE_LIMITS } from "@qubo/protocol";
import { accessFor, type Entitlements } from "../src";

const ent = (orgs: number | null, sites: number | null): Entitlements => ({
  source: "licence", plan: "growth", features: [], limits: { ...FREE_LIMITS, orgs, sites },
});
const d = (n: number) => new Date(2026, 0, n);
const orgs = [{ id: "hm", createdAt: d(1) }, { id: "tailg", createdAt: d(5) }];

describe("accessFor (pooled limits)", () => {
  it("Free: the newer org is locked, its site too", () => {
    const a = accessFor(ent(1, 1), orgs, [
      { id: "hm-site", organizationId: "hm", createdAt: d(2) },
      { id: "tailg-site", organizationId: "tailg", createdAt: d(6) },
    ]);
    expect([...a.lockedOrgIds]).toEqual(["tailg"]);
    expect([...a.lockedSiteIds]).toEqual(["tailg-site"]);
    expect(a.orgs.canCreate).toBe(false);
    expect(a.sites.canCreate).toBe(false);
  });

  it("Growth: 4 sites may live in one org", () => {
    const sites = [1, 2, 3, 4].map((n) => ({ id: `s${n}`, organizationId: "hm", createdAt: d(n + 1) }));
    const a = accessFor(ent(2, 4), orgs.slice(0, 1), sites);
    expect(a.lockedSiteIds.size).toBe(0);
    expect(a.orgs.canCreate).toBe(true);
    expect(a.sites.canCreate).toBe(false);
  });

  it("Growth: 3 + 1 split uses the whole pool", () => {
    const a = accessFor(ent(2, 4), orgs, [
      ...[1, 2, 3].map((n) => ({ id: `hm${n}`, organizationId: "hm", createdAt: d(n + 1) })),
      { id: "t1", organizationId: "tailg", createdAt: d(6) },
    ]);
    expect(a.lockedSiteIds.size).toBe(0);
    expect(a.sites).toMatchObject({ used: 4, limit: 4, canCreate: false });
  });

  it("downgrade: oldest sites stay licensed, newest are locked", () => {
    const a = accessFor(ent(2, 2), orgs, [
      { id: "a", organizationId: "hm", createdAt: d(2) },
      { id: "b", organizationId: "tailg", createdAt: d(6) },
      { id: "c", organizationId: "hm", createdAt: d(7) },
    ]);
    expect([...a.lockedSiteIds]).toEqual(["c"]);
  });

  it("unlimited", () => {
    const a = accessFor(ent(null, null), orgs, []);
    expect(a.orgs.canCreate && a.sites.canCreate).toBe(true);
  });
});
