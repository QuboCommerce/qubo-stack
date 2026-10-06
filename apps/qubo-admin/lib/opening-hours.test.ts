import { describe, expect, it } from "bun:test";
import { collapseHours, expandHours, hoursFromForm } from "./opening-hours";

describe("opening hours", () => {
  it("expands rules to seven days and collapses identical days back into one rule", () => {
    const rules = [
      { days: ["mo", "tu", "we", "th", "fr"] as const, opens: "09:00", closes: "18:00" },
      { days: ["sa"] as const, opens: "10:00", closes: "16:00" },
    ].map((r) => ({ ...r, days: [...r.days] }));
    const days = expandHours(rules);
    expect(days.mo).toEqual({ open: true, opens: "09:00", closes: "18:00" });
    expect(days.su.open).toBe(false);
    expect(collapseHours(days)).toEqual(rules);
  });

  it("drops closed days, bad times and ranges that end before they start", () => {
    const form: Record<string, string> = { hours_mo_open: "on", hours_mo_opens: "09:00", hours_mo_closes: "18:00", hours_tu_open: "on", hours_tu_opens: "18:00", hours_tu_closes: "09:00", hours_we_open: "on", hours_we_opens: "9h", hours_we_closes: "18:00", hours_th_open: "", hours_th_opens: "09:00", hours_th_closes: "18:00" };
    expect(hoursFromForm((n) => form[n] ?? "")).toEqual([{ days: ["mo"], opens: "09:00", closes: "18:00" }]);
  });
});
