import { describe, expect, it } from "vitest";
import { hmFroidTheme } from "@qubo/stylekit";
import { pageBlocksNative, pageEffect, pageOverlay, pageTransitionId } from "../page-settings";
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
    expect(slim.motion.transitions.map((t) => t.id)).toEqual(base.motion.transitions.map((t) => t.id));
    expect(slim.motion.transition).toBe(id);
    expect(Object.keys(slim)).toEqual(["brand", "motion"]);
  });

  it("resolves a page's own transition and effect over the theme", () => {
    const [a, b] = hmFroidTheme.motion.transitions;
    const theme = { ...hmFroidTheme, motion: { ...hmFroidTheme.motion, transition: a!.id } };
    expect(pageTransitionId(theme, {})).toBe(a!.id);
    expect(pageTransitionId(theme, { transition: b!.id })).toBe(b!.id);
    expect(pageTransitionId(theme, { transition: "none" })).toBe("");
    expect(pageTransitionId(theme, { transition: "gone" })).toBe(a!.id);
    expect(runtimeTheme(theme, { transition: "none" })!.motion.transition).toBe("");
    expect(pageOverlay(theme, { transition: b!.id })?.id).toBe(b!.id);

    const native = { ...theme, motion: { ...theme.motion, transition: "native" } };
    expect(pageBlocksNative(native, {})).toBe(false);
    expect(pageBlocksNative(native, { transition: "none" })).toBe(true);
    expect(pageBlocksNative(native, { transition: b!.id })).toBe(true);

    const snow = hmFroidTheme.effects.presets[0]!;
    const fx = { ...hmFroidTheme, effects: { ...hmFroidTheme.effects, active: snow.id, schedule: { enabled: true, from: "12-01", to: "01-06" } } };
    expect(pageEffect(fx, {})).toEqual({ effect: snow, schedule: "12-01..01-06" });
    expect(pageEffect(fx, { effect: "none" })).toBeNull();
    const other = hmFroidTheme.effects.presets[1]!;
    expect(pageEffect(fx, { effect: other.id })).toEqual({ effect: other });
    expect(pageEffect({ ...fx, effects: { ...fx.effects, active: "" } }, {})).toBeNull();
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
