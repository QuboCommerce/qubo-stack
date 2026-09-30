import { describe, expect, it } from "vitest";
import {
  builtInThemes,
  collapseMode,
  compileTheme,
  contrastRatio,
  defineTheme,
  diagnoseTheme,
  expandToDual,
  googleFontsUrl,
  parseColor,
  renameToken,
  resolveRoleColor,
  smossieTheme,
  toHex,
  usedBy,
  type ThemeInput,
} from "../src";

const minimal: ThemeInput = {
  id: "mini",
  name: "Mini",
  modeStrategy: "light",
  palette: [
    { id: "paper", name: "Paper", value: "#ffffff" },
    { id: "ink", name: "Ink", value: "#111111" },
    { id: "brand", name: "Brand", value: "#1d4ed8" },
  ],
  schemes: [{ id: "base", name: "Base", light: { background: "paper", text: "ink", primary: "brand", onPrimary: "paper" } }],
  defaultScheme: "base",
  typeset: {
    fonts: [{ id: "sys", family: "system-ui" }],
    roles: { display: { font: "sys" }, heading: { font: "sys" }, body: { font: "sys" }, accent: { font: "sys" }, mono: { font: "sys" } },
  },
  buttons: [{ id: "default", name: "Default" }],
  defaultButton: "default",
};

describe("schema", () => {
  it("fills defaults for a minimal theme", () => {
    const t = defineTheme(minimal);
    expect(t.space.unitMin).toBe(4);
    expect(t.motion.entrance).toBe("fade");
    expect(t.flavor.id).toBe("fancy");
  });

  it("rejects non-slug ids", () => {
    expect(() => defineTheme({ ...minimal, id: "Not A Slug" })).toThrow();
  });

  it("parses every built-in theme", () => {
    expect(Object.keys(builtInThemes).sort()).toEqual(["hm-froid", "lume", "smossie", "tailg"]);
  });
});

describe("color", () => {
  it("computes WCAG contrast", () => {
    expect(contrastRatio(parseColor("#000")!, parseColor("#fff")!)).toBe(21);
  });
  it("round-trips hex", () => {
    expect(toHex(parseColor("#EE5934")!)).toBe("#ee5934");
  });
});

describe("resolve", () => {
  const t = defineTheme(minimal);
  const scheme = t.schemes[0]!;

  it("falls back for unset optional roles", () => {
    const link = resolveRoleColor(t, scheme, "light", "link");
    expect(toHex(link!)).toBe("#1d4ed8");
    const muted = resolveRoleColor(t, scheme, "light", "textMuted");
    expect(muted?.alpha).toBeCloseTo(0.72);
  });

  it("renames a token everywhere", () => {
    const next = renameToken(smossieTheme, "paper", "linen");
    expect(usedBy(next, "paper")).toHaveLength(0);
    expect(usedBy(next, "linen").length).toBe(usedBy(smossieTheme, "paper").length);
    expect(usedBy(next, "linen").length).toBeGreaterThan(20);
    expect(() => renameToken(smossieTheme, "paper", "ink")).toThrow();
  });

  it("collapses and expands modes", () => {
    const lume = builtInThemes.lume;
    const dark = collapseMode(lume, "dark");
    expect(dark.modeStrategy).toBe("dark");
    expect(dark.schemes.every((s) => !s.light && s.dark)).toBe(true);
    const dual = expandToDual(dark);
    expect(dual.schemes.every((s) => s.light && s.dark)).toBe(true);
  });
});

describe("compile", () => {
  it("builds a Google Fonts URL with only the weights the roles use", () => {
    expect(googleFontsUrl(defineTheme(minimal))).toBeNull();
    const url = googleFontsUrl(
      defineTheme({
        ...minimal,
        typeset: {
          fonts: [
            { id: "inter", family: "Inter", source: "google" },
            { id: "dm", family: "DM Serif Display", source: "google" },
          ],
          roles: {
            display: { font: "dm", weight: 400 },
            heading: { font: "inter", weight: 700 },
            body: { font: "inter", weight: 400 },
            accent: { font: "inter", weight: 600 },
            mono: { font: "inter", weight: 500 },
          },
        },
      }),
    );
    expect(url).toBe(
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=DM+Serif+Display:wght@400&display=swap",
    );
  });

  it("snaps requested weights to the weights a font provides", () => {
    const url = googleFontsUrl(
      defineTheme({
        ...minimal,
        typeset: {
          fonts: [{ id: "dm", family: "DM Serif Display", source: "google", weights: [400] }],
          roles: {
            display: { font: "dm", weight: 400 },
            heading: { font: "dm", weight: 700 },
            body: { font: "dm", weight: 400 },
            accent: { font: "dm", weight: 600 },
            mono: { font: "dm", weight: 500 },
          },
        },
      }),
    );
    expect(url).toBe("https://fonts.googleapis.com/css2?family=DM+Serif+Display:wght@400&display=swap");
  });

  it("emits scoped tokens, schemes and buttons", () => {
    const { css, hash } = compileTheme(defineTheme(minimal));
    expect(css).toContain('[data-theme="mini"] {');
    expect(css).toContain("--pk-color-brand: oklch(");
    expect(css).toContain('[data-theme="mini"] [data-scheme="base"]');
    expect(css).toContain("--pk-primary: var(--pk-color-brand);");
    expect(css).toContain("--pk-link: var(--pk-primary);");
    expect(css).toContain("--pk-text-muted: oklch(from var(--pk-text) l c h / 0.72);");
    expect(css).toContain('[data-button-style="default"]');
    expect(css).toContain("color-scheme: light;");
    expect(css).not.toContain('data-mode="dark"');
    expect(hash).toMatch(/^[0-9a-z]+$/);
  });

  it("emits dark + system blocks only for dual themes", () => {
    const { css } = compileTheme(builtInThemes.lume);
    expect(css).toContain('[data-theme="lume"][data-mode="dark"] [data-scheme="canvas"]');
    expect(css).toContain("@media (prefers-color-scheme: dark)");
    const collapsed = compileTheme(collapseMode(builtInThemes.lume, "light")).css;
    expect(collapsed).not.toContain("prefers-color-scheme");
  });

  it("is deterministic", () => {
    expect(compileTheme(smossieTheme).hash).toBe(compileTheme(smossieTheme).hash);
  });

  it("resolves font asset urls", () => {
    const t = defineTheme({
      ...minimal,
      typeset: { ...minimal.typeset, fonts: [{ id: "sys", family: "Brand", source: "asset", files: [{ src: "asset_123" }] }] },
    });
    const { css } = compileTheme(t, { resolveAssetUrl: (id) => `https://cdn.test/${id}.woff2` });
    expect(css).toContain('url("https://cdn.test/asset_123.woff2")');
  });
});

describe("doctor", () => {
  it("scores a clean minimal theme highly and rates it essential", () => {
    const r = diagnoseTheme(defineTheme(minimal));
    expect(r.findings.filter((f) => f.severity === "error")).toEqual([]);
    expect(r.health).toBeGreaterThanOrEqual(80);
    expect(r.richness.tier).toBe("essential");
  });

  it("flags raw colours, missing tokens and bad contrast", () => {
    const bad = defineTheme({
      ...minimal,
      palette: [...minimal.palette, { id: "pale", name: "Pale", value: "#eeeeee" }],
      schemes: [{ id: "base", name: "Base", light: { background: "paper", text: "pale", primary: "nope", onPrimary: "paper" } }],
    });
    const checks = diagnoseTheme(bad).findings.map((f) => f.check);
    expect(checks).toContain("scheme.unknown-token");
    expect(checks).toContain("contrast");
    expect(diagnoseTheme(bad).health).toBeLessThan(80);
  });

  it("checks accent text only when a scheme maps it", () => {
    const pale = [...minimal.palette, { id: "pale", name: "Pale", value: "#eeeeee" }];
    const pairs = (accentText?: string) =>
      diagnoseTheme(
        defineTheme({
          ...minimal,
          palette: pale,
          schemes: [{ id: "base", name: "Base", light: { background: "paper", text: "ink", primary: "brand", onPrimary: "paper", ...(accentText ? { accentText } : {}) } }],
        }),
      ).contrast.filter((c) => c.fg === "accentText");
    expect(pairs()).toEqual([]);
    expect(pairs("pale")).toMatchObject([{ pass: false }]);
    expect(toHex(resolveRoleColor(defineTheme(minimal), defineTheme(minimal).schemes[0]!, "light", "accentText")!)).toBe("#1d4ed8");
  });

  it("gives built-in themes a passing grade", () => {
    for (const theme of Object.values(builtInThemes)) {
      const r = diagnoseTheme(theme);
      const errors = r.findings.filter((f) => f.severity === "error");
      expect(errors, `${theme.id}: ${errors.map((e) => e.message).join("\n")}`).toEqual([]);
    }
  });

  it("rates smossie richer than the minimal theme", () => {
    expect(diagnoseTheme(smossieTheme).richness.score).toBeGreaterThan(diagnoseTheme(defineTheme(minimal)).richness.score);
  });
});
