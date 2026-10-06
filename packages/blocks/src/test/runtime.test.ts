import { describe, expect, it } from "vitest";
import { hmFroidTheme } from "@qubo/stylekit";
import { ARRIVAL_KEY, arrivalScript, inSchedule, overlayTransition, resolveEasing, runtimeTheme } from "../runtime";

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

  it("picks the overlay preset, never native or a disabled profile", () => {
    const base = hmFroidTheme;
    const id = base.motion.transitions[0]!.id;
    expect(overlayTransition({ motion: { ...base.motion, transition: "" } })).toBeNull();
    expect(overlayTransition({ motion: { ...base.motion, transition: "native" } })).toBeNull();
    expect(overlayTransition({ motion: { ...base.motion, transition: id } })?.id).toBe(id);
    expect(overlayTransition({ motion: { ...base.motion, transition: id, profile: "none" } })).toBeNull();
    const slim = runtimeTheme({ ...base, motion: { ...base.motion, transition: id } })!;
    expect(slim.motion.transitions.map((t) => t.id)).toEqual([id]);
    expect(Object.keys(slim)).toEqual(["brand", "motion"]);
  });

  it("arrival script paints the stored cover and strips CSS breakouts", () => {
    const store = new Map<string, string>();
    const head: { textContent: string }[] = [];
    const attrs: Record<string, string> = {};
    const env = {
      sessionStorage: { getItem: (k: string) => store.get(k) ?? null, removeItem: (k: string) => store.delete(k) },
      document: {
        createElement: () => ({ id: "", textContent: "" }),
        head: { appendChild: (el: { textContent: string }) => head.push(el) },
        documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) },
      },
    };
    const run = () => new Function("sessionStorage", "document", arrivalScript())(env.sessionStorage, env.document);
    run();
    expect(head).toHaveLength(0);
    store.set(ARRIVAL_KEY, JSON.stringify({ id: "full", t: Date.now(), color: "rgb(0, 64, 140)}body{display:none", image: "", blur: 0 }));
    run();
    expect(attrs["data-qb-arriving"]).toBe("full");
    expect(head[0]!.textContent).toContain("background-color:rgb(0, 64, 140)bodydisplay:none");
    expect(head[0]!.textContent.match(/\}/g)).toHaveLength(3);
    store.set(ARRIVAL_KEY, JSON.stringify({ id: "old", t: Date.now() - 60_000, color: "red", image: "", blur: 0 }));
    run();
    expect(store.has(ARRIVAL_KEY)).toBe(false);
  });
});
