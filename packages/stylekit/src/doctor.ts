import { colorDistance, contrastRatio, parseColor } from "./color";
import { activeModes, normalizeRef, resolveRoleColor, usedBy } from "./resolve";
import type { Mode, Role, Theme } from "./schema";
import { roles } from "./schema";

/**
 * Palette Doctor v2.
 *
 * Two independent axes, because an "essential" theme is not a worse theme:
 *   - health   (0-100): is it correct? contrast, resolvable references, parity
 *   - richness (tier) : how much does it offer? schemes, modes, button styles
 */

export type Severity = "error" | "warning" | "info";

export type Finding = {
  check: string;
  severity: Severity;
  message: string;
  hint?: string;
  scheme?: string;
  mode?: Mode;
  role?: Role;
  token?: string;
};

export type RichnessTier = "essential" | "complete" | "premium";

export type DoctorReport = {
  health: number;
  richness: { tier: RichnessTier; score: number; signals: Record<string, boolean | number> };
  findings: Finding[];
  /** Measured contrast for every checked pair — powers the swatch grid UI. */
  contrast: { scheme: string; mode: Mode; fg: Role; bg: Role; ratio: number; min: number; pass: boolean }[];
};

/** fg/bg pairs and their WCAG 2.2 minimums (4.5 body text, 3 large/UI). */
export const contrastPairs: {
  fg: Role;
  bg: Role;
  min: number;
  label: string;
  advisory?: boolean;
  /** Only checked when the scheme maps `fg` itself; its fallback is already covered by another pair. */
  explicitOnly?: boolean;
}[] = [
  { fg: "text", bg: "background", min: 4.5, label: "Body text" },
  { fg: "textMuted", bg: "background", min: 4.5, label: "Muted text" },
  { fg: "heading", bg: "background", min: 3, label: "Headings (large)" },
  { fg: "text", bg: "backgroundAlt", min: 4.5, label: "Text on alt background" },
  { fg: "onSurface", bg: "surface", min: 4.5, label: "Text on cards" },
  { fg: "onPrimary", bg: "primary", min: 4.5, label: "Primary button label" },
  { fg: "onSecondary", bg: "secondary", min: 4.5, label: "Secondary button label" },
  { fg: "onAccent", bg: "accent", min: 3, label: "Text on accent" },
  { fg: "link", bg: "background", min: 4.5, label: "Links" },
  { fg: "accentText", bg: "background", min: 4.5, label: "Accent text (eyebrows, highlights)", explicitOnly: true },
  // Advisory: the label already identifies the button, so a low-contrast fill is a style choice.
  { fg: "primary", bg: "background", min: 3, label: "Primary button vs page", advisory: true },
  { fg: "focusRing", bg: "background", min: 3, label: "Focus ring" },
];

/**
 * Health = contrast (70) + structure (30).
 * Contrast gives partial credit, so 4.3:1 against a 4.5 target barely dents
 * the score while 1.8:1 costs nearly the full share of that pair.
 */
const CONTRAST_WEIGHT = 70;
const STRUCTURE_WEIGHT = 30;
const structurePenalty: Record<Severity, number> = { error: 10, warning: 3, info: 0 };

function contrastCredit(ratio: number, min: number): number {
  if (ratio >= min) return 1;
  return Math.max(0, (ratio - 1) / (min - 1)) ** 2;
}

export function diagnoseTheme(theme: Theme): DoctorReport {
  const findings: Finding[] = [];
  const contrast: DoctorReport["contrast"] = [];
  const modes = activeModes(theme);
  const tokenIds = new Set(theme.palette.map((t) => t.id));

  // Palette values must parse.
  for (const token of theme.palette) {
    if (!parseColor(token.value)) {
      findings.push({
        check: "palette.parse",
        severity: "error",
        token: token.id,
        message: `"${token.name}" has an unreadable colour value (${token.value}).`,
        hint: "Use hex, rgb() or oklch().",
      });
    }
    if (!token.description.trim()) {
      findings.push({
        check: "palette.description",
        severity: "info",
        token: token.id,
        message: `"${token.name}" has no description.`,
        hint: "Say what it's for — future you will thank you.",
      });
    }
  }

  // References: every mapped token exists; raw colours are not allowed.
  for (const scheme of theme.schemes) {
    for (const mode of ["light", "dark"] as const) {
      const map = scheme[mode];
      if (!map) continue;
      for (const role of roles) {
        const ref = map[role];
        if (!ref) continue;
        const { token } = normalizeRef(ref);
        if (!tokenIds.has(token)) {
          const looksRaw = parseColor(token) !== null || token.startsWith("#");
          findings.push({
            check: looksRaw ? "scheme.raw-color" : "scheme.unknown-token",
            severity: "error",
            scheme: scheme.id,
            mode,
            role,
            message: looksRaw
              ? `${scheme.name} › ${role} uses a raw colour; schemes may only reference palette tokens.`
              : `${scheme.name} › ${role} references missing token "${token}".`,
            hint: looksRaw ? "Add it to the palette (or reuse an existing token) and reference it." : undefined,
          });
        }
      }
    }
  }

  for (const shadow of theme.shape.shadows) {
    const { token } = normalizeRef(shadow.color);
    if (!tokenIds.has(token)) {
      findings.push({
        check: "shadow.unknown-token",
        severity: "error",
        token,
        message: `Shadow "${shadow.name}" references missing token "${token}".`,
      });
    }
  }

  // Mode coverage.
  for (const scheme of theme.schemes) {
    if (theme.modeStrategy === "dual" && (!scheme.light || !scheme.dark)) {
      findings.push({
        check: "mode.parity",
        severity: "warning",
        scheme: scheme.id,
        message: `${scheme.name} has no ${scheme.light ? "dark" : "light"} mapping; it will reuse the other mode.`,
        hint: "Map it explicitly or collapse the theme to a single mode.",
      });
    }
    if (theme.modeStrategy !== "dual" && !scheme[theme.modeStrategy]) {
      findings.push({
        check: "mode.missing",
        severity: "warning",
        scheme: scheme.id,
        message: `${scheme.name} has no ${theme.modeStrategy} mapping.`,
      });
    }
  }

  // Contrast.
  for (const scheme of theme.schemes) {
    for (const mode of modes) {
      for (const pair of contrastPairs) {
        if (pair.explicitOnly && !scheme[mode]?.[pair.fg]) continue;
        const fg = resolveRoleColor(theme, scheme, mode, pair.fg);
        const bg = resolveRoleColor(theme, scheme, mode, pair.bg);
        if (!fg || !bg) continue;
        const ratio = contrastRatio(fg, bg);
        const pass = ratio >= pair.min;
        contrast.push({ scheme: scheme.id, mode, fg: pair.fg, bg: pair.bg, ratio, min: pair.min, pass });
        if (!pass) {
          findings.push({
            check: "contrast",
            severity: pair.advisory ? "info" : pair.min >= 4.5 && ratio < 3 ? "error" : "warning",
            scheme: scheme.id,
            mode,
            role: pair.fg,
            message: `${scheme.name} (${mode}) · ${pair.label}: ${ratio}:1, needs ${pair.min}:1.`,
            hint: "Pick a darker/lighter token, or nudge lightness with a mix.",
          });
        }
      }

      const primary = resolveRoleColor(theme, scheme, mode, "primary");
      const secondary = resolveRoleColor(theme, scheme, mode, "secondary");
      if (primary && secondary && colorDistance(primary, secondary) < 8) {
        findings.push({
          check: "buttons.distinct",
          severity: "warning",
          scheme: scheme.id,
          mode,
          message: `${scheme.name} (${mode}): primary and secondary are nearly identical.`,
        });
      }
    }
  }

  // Housekeeping.
  for (const token of theme.palette) {
    if (usedBy(theme, token.id).length === 0) {
      findings.push({
        check: "palette.unused",
        severity: "info",
        token: token.id,
        message: `"${token.name}" isn't used by any scheme.`,
      });
    }
  }
  const dupes = findDuplicateTokens(theme);
  for (const [a, b] of dupes) {
    findings.push({
      check: "palette.duplicate",
      severity: "warning",
      token: b,
      message: `"${a}" and "${b}" are visually identical.`,
      hint: "Merge them so an edit only has to happen once.",
    });
  }
  if (!theme.schemes.some((s) => s.id === theme.defaultScheme)) {
    findings.push({ check: "theme.default-scheme", severity: "error", message: `Default scheme "${theme.defaultScheme}" doesn't exist.` });
  }
  if (!theme.buttons.some((b) => b.id === theme.defaultButton)) {
    findings.push({ check: "theme.default-button", severity: "error", message: `Default button style "${theme.defaultButton}" doesn't exist.` });
  }
  const fontIds = new Set(theme.typeset.fonts.map((f) => f.id));
  for (const [role, setting] of Object.entries(theme.typeset.roles)) {
    if (!fontIds.has(setting.font)) {
      findings.push({ check: "typeset.font", severity: "error", message: `Font role "${role}" uses missing font "${setting.font}".` });
    }
  }
  for (const font of theme.typeset.fonts) {
    if (font.source === "asset" && font.files.length === 0) {
      findings.push({
        check: "typeset.files",
        severity: "warning",
        message: `${font.family} has no font files; visitors will see the fallback.`,
        hint: "Upload the font files in the font library.",
      });
    }
  }

  const scored = contrast.filter((c) => !contrastPairs.find((p) => p.fg === c.fg && p.bg === c.bg)?.advisory);
  const contrastScore = scored.length
    ? scored.reduce((sum, c) => sum + contrastCredit(c.ratio, c.min), 0) / scored.length
    : 0;
  const structural = findings
    .filter((f) => f.check !== "contrast")
    .reduce((sum, f) => sum + structurePenalty[f.severity], 0);
  const health = Math.round(
    CONTRAST_WEIGHT * contrastScore + Math.max(0, STRUCTURE_WEIGHT - structural),
  );
  return { health, richness: richness(theme), findings, contrast };
}

function findDuplicateTokens(theme: Theme): [string, string][] {
  const parsed = theme.palette
    .map((t) => ({ id: t.id, c: parseColor(t.value) }))
    .filter((t): t is { id: string; c: NonNullable<typeof t.c> } => t.c !== null);
  const out: [string, string][] = [];
  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      if (colorDistance(parsed[i]!.c, parsed[j]!.c) < 1) out.push([parsed[i]!.id, parsed[j]!.id]);
    }
  }
  return out;
}

function richness(theme: Theme): DoctorReport["richness"] {
  const explicitRoles = new Set(
    theme.schemes.flatMap((s) => [s.light, s.dark].flatMap((m) => (m ? Object.keys(m) : []))),
  );
  const signals = {
    schemes: theme.schemes.length,
    dualMode: theme.modeStrategy === "dual",
    buttonStyles: theme.buttons.length,
    shadows: theme.shape.shadows.length,
    motion: theme.motion.profile !== "none",
    customFonts: theme.typeset.fonts.some((f) => f.source !== "system"),
    roleCoverage: explicitRoles.size,
  };
  const score =
    Math.min(signals.schemes, 8) * 5 +
    (signals.dualMode ? 20 : 0) +
    Math.min(signals.buttonStyles, 4) * 5 +
    Math.min(signals.shadows, 3) * 3 +
    (signals.motion ? 8 : 0) +
    (signals.customFonts ? 8 : 0) +
    Math.round((signals.roleCoverage / roles.length) * 15);
  const tier: RichnessTier = score >= 75 ? "premium" : score >= 45 ? "complete" : "essential";
  return { tier, score: Math.min(100, score), signals };
}
