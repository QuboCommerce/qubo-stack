import { describe, expect, it } from "vitest";
import { inSchedule, resolveEasing } from "../runtime";

describe("runtime helpers", () => {
  it("schedules wrap the new year", () => {
    const s = { enabled: true, from: "12-01", to: "01-06" };
    expect(inSchedule(s, new Date(2026, 11, 24))).toBe(true);
    expect(inSchedule(s, new Date(2027, 0, 3))).toBe(true);
    expect(inSchedule(s, new Date(2026, 6, 1))).toBe(false);
    expect(inSchedule({ ...s, from: "03-01", to: "03-31" }, new Date(2026, 2, 15))).toBe(true);
    expect(inSchedule({ ...s, enabled: false }, new Date(2026, 6, 1))).toBe(true);
  });

  it("resolves easing names, raw curves and the theme default", () => {
    expect(resolveEasing("gentle")).toBe("cubic-bezier(0.32, 0.72, 0, 1)");
    expect(resolveEasing("steps(4)")).toBe("steps(4)");
    expect(resolveEasing("", { motion: { easing: "linear" } } as never)).toBe("linear");
  });
});
