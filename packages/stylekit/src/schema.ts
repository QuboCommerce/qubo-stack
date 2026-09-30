import { z } from "zod";

/**
 * StyleKit theme model, v1.
 *
 * The one rule that shapes everything here: a colour value lives in exactly
 * one place — the palette. Schemes, buttons and shadows only *reference*
 * palette tokens, so "make the cream a bit brighter" is a single edit that
 * every scheme picks up.
 */

export const THEME_SCHEMA_VERSION = 1;

const slug = z
  .string()
  .min(1)
  .max(48)
  .regex(/^[a-z][a-z0-9-]*$/, "lowercase letters, digits and dashes");

// ---------------------------------------------------------------- palette ---

export const tokenGroups = [
  "brand",
  "neutral",
  "accent",
  "feedback",
  "custom",
] as const;
export type TokenGroup = (typeof tokenGroups)[number];

export const PaletteTokenSchema = z.object({
  id: slug,
  name: z.string().min(1),
  /** Why this colour exists — the comment you'd write above a CSS variable. */
  description: z.string().default(""),
  group: z.enum(tokenGroups).default("custom"),
  /** Brand colours the merchant must not edit (builder can unlock). */
  locked: z.boolean().default(false),
  /** Any CSS colour the parser understands; normalised to OKLCH on compile. */
  value: z.string().min(1),
});
export type PaletteToken = z.infer<typeof PaletteTokenSchema>;

// ---------------------------------------------------------------- schemes ---

/**
 * Semantic roles a scheme assigns. Only the first four are required; the
 * rest fall back (see `roleFallbacks` in resolve.ts), which is what lets an
 * "essential" theme stay small without being broken.
 */
export const requiredRoles = [
  "background",
  "text",
  "primary",
  "onPrimary",
] as const;

export const optionalRoles = [
  "backgroundAlt",
  "surface",
  "onSurface",
  "textMuted",
  "heading",
  "accent",
  "onAccent",
  /** Accent used as text (eyebrows, highlighted words, ratings); `accent` is a fill. */
  "accentText",
  "secondary",
  "onSecondary",
  "link",
  "border",
  "focusRing",
] as const;

export const roles = [...requiredRoles, ...optionalRoles] as const;
export type Role = (typeof roles)[number];

/** A tweak applied to a referenced token, compiled to CSS relative colour. */
export const ColorMixSchema = z.object({
  /** Added to OKLCH lightness, -1..1 (e.g. 0.04 = slightly lighter). */
  lightness: z.number().min(-1).max(1).optional(),
  /** Multiplies chroma, 0..2 (0 = greyscale). */
  chroma: z.number().min(0).max(2).optional(),
  /** Opacity 0..1. */
  alpha: z.number().min(0).max(1).optional(),
});
export type ColorMix = z.infer<typeof ColorMixSchema>;

/**
 * `"cream"` or `{ token: "cream", mix: { alpha: 0.6 } }`. Never a raw colour:
 * the doctor flags anything that isn't a palette token id.
 */
export const RoleRefSchema = z.union([
  slug,
  z.object({ token: slug, mix: ColorMixSchema.optional() }),
]);
export type RoleRef = z.infer<typeof RoleRefSchema>;

export const RoleMapSchema = z
  .object({
    background: RoleRefSchema,
    text: RoleRefSchema,
    primary: RoleRefSchema,
    onPrimary: RoleRefSchema,
  })
  .extend(
    Object.fromEntries(optionalRoles.map((r) => [r, RoleRefSchema.optional()])) as {
      [K in (typeof optionalRoles)[number]]: z.ZodOptional<typeof RoleRefSchema>;
    },
  );
export type RoleMap = z.infer<typeof RoleMapSchema>;

export const SchemeSchema = z.object({
  id: slug,
  /** Named by use case — "Cream canvas", "Navy spotlight" — never "Scheme 7". */
  name: z.string().min(1),
  description: z.string().default(""),
  light: RoleMapSchema.optional(),
  dark: RoleMapSchema.optional(),
});
export type Scheme = z.infer<typeof SchemeSchema>;

/**
 * `dual` ships light + dark and lets the visitor/OS choose. The single modes
 * are a *collapsed* theme: only one mapping exists and no dark CSS is emitted.
 */
export const modeStrategies = ["dual", "light", "dark"] as const;
export type ModeStrategy = (typeof modeStrategies)[number];
export type Mode = "light" | "dark";

// ------------------------------------------------------------- typography ---

export const fontRoles = ["display", "heading", "body", "accent", "mono"] as const;
export type FontRole = (typeof fontRoles)[number];

export const FontFaceFileSchema = z.object({
  /** Asset id (media service) or absolute URL for bundled/system fonts. */
  src: z.string().min(1),
  weight: z.union([z.number(), z.string()]).default(400),
  style: z.enum(["normal", "italic"]).default("normal"),
  format: z.enum(["woff2", "woff", "truetype", "opentype"]).default("woff2"),
});

export const FontSchema = z.object({
  id: slug,
  family: z.string().min(1),
  /** CSS fallback stack appended after the family. */
  fallback: z.string().default("system-ui, sans-serif"),
  source: z.enum(["system", "asset", "google"]).default("system"),
  files: z.array(FontFaceFileSchema).default([]),
  /** Weights the source provides. Requests snap to these so a missing weight can't break the font load. */
  weights: z.array(z.number().int().min(1).max(1000)).min(1).optional(),
});
export type Font = z.infer<typeof FontSchema>;

export const FontRoleSettingSchema = z.object({
  font: slug,
  weight: z.number().int().min(100).max(1000).default(400),
  /** Letter spacing in em. */
  tracking: z.number().min(-0.2).max(0.5).default(0),
  lineHeight: z.number().min(0.8).max(2.4).default(1.5),
  uppercase: z.boolean().default(false),
});

/** Fluid type scale (Utopia-style): each step interpolates min→max viewport. */
export const TypeScaleSchema = z.object({
  baseMin: z.number().min(10).max(28).default(16),
  baseMax: z.number().min(10).max(32).default(18),
  ratioMin: z.number().min(1).max(2).default(1.2),
  ratioMax: z.number().min(1).max(2).default(1.25),
  viewportMin: z.number().default(360),
  viewportMax: z.number().default(1280),
});

export const TypesetSchema = z.object({
  fonts: z.array(FontSchema).min(1),
  roles: z.object(
    Object.fromEntries(fontRoles.map((r) => [r, FontRoleSettingSchema])) as {
      [K in FontRole]: typeof FontRoleSettingSchema;
    },
  ),
  scale: TypeScaleSchema.default(TypeScaleSchema.parse({})),
});
export type Typeset = z.infer<typeof TypesetSchema>;

// ---------------------------------------------------------- space & shape ---

export const SpaceScaleSchema = z.object({
  /** Base unit in px at the smallest/largest viewport. */
  unitMin: z.number().min(2).max(16).default(4),
  unitMax: z.number().min(2).max(20).default(6),
});

export const ShadowSchema = z.object({
  id: slug,
  name: z.string(),
  x: z.number().default(0),
  y: z.number().default(4),
  blur: z.number().min(0).default(12),
  spread: z.number().default(0),
  /** Palette token; `mix.alpha` controls strength. */
  color: RoleRefSchema.default({ token: "ink", mix: { alpha: 0.12 } }),
});
export type Shadow = z.infer<typeof ShadowSchema>;

export const ShapeSchema = z.object({
  /** Base radius in px; the scale is derived from it. */
  radius: z.number().min(0).max(48).default(8),
  borderWidth: z.number().min(0).max(8).default(1),
  shadows: z.array(ShadowSchema).default([]),
});
export type Shape = z.infer<typeof ShapeSchema>;

export const radiusSteps = ["none", "sm", "md", "lg", "xl", "full"] as const;
export type RadiusStep = (typeof radiusSteps)[number];

// ---------------------------------------------------------------- buttons ---

/**
 * A named visual recipe. Colours come from the scheme the button sits in
 * (primary/secondary/…), so the same "Chunky 3D" style looks right on a cream
 * section and a navy one without being redefined.
 */
export const ButtonStyleSchema = z.object({
  id: slug,
  name: z.string(),
  radius: z.enum(radiusSteps).default("md"),
  borderWidth: z.number().min(0).max(6).default(0),
  /** Shadow preset id from `shape.shadows`, or none. */
  shadow: z.string().nullable().default(null),
  fontRole: z.enum(fontRoles).default("body"),
  weight: z.number().int().min(100).max(1000).default(600),
  uppercase: z.boolean().default(false),
  tracking: z.number().default(0),
  /** Padding in space-scale steps. */
  paddingX: z.number().int().min(1).max(12).default(5),
  paddingY: z.number().int().min(1).max(8).default(3),
  hover: z.enum(["none", "darken", "lift", "press", "glow"]).default("darken"),
});
export type ButtonStyle = z.infer<typeof ButtonStyleSchema>;

export const buttonEmphases = ["primary", "secondary", "outline", "ghost", "link"] as const;
export type ButtonEmphasis = (typeof buttonEmphases)[number];

// ----------------------------------------------------------------- motion ---

export const entrancePresets = ["none", "fade", "rise", "scale", "blur"] as const;
export type EntrancePreset = (typeof entrancePresets)[number];

export const MotionSchema = z.object({
  profile: z.enum(["none", "subtle", "lively"]).default("subtle"),
  durationFast: z.number().min(0).max(2000).default(150),
  durationBase: z.number().min(0).max(4000).default(300),
  durationSlow: z.number().min(0).max(6000).default(600),
  easing: z.string().default("cubic-bezier(0.2, 0.8, 0.2, 1)"),
  entrance: z.enum(entrancePresets).default("fade"),
});
export type Motion = z.infer<typeof MotionSchema>;

// ------------------------------------------------------------------ theme ---

export const FlavorRefSchema = z.object({
  id: slug.default("fancy"),
  options: z.record(z.string(), z.unknown()).default({}),
});

export const ThemeSchema = z.object({
  schemaVersion: z.literal(THEME_SCHEMA_VERSION).default(THEME_SCHEMA_VERSION),
  id: slug,
  name: z.string().min(1),
  description: z.string().default(""),
  modeStrategy: z.enum(modeStrategies).default("light"),
  palette: z.array(PaletteTokenSchema).min(1),
  schemes: z.array(SchemeSchema).min(1),
  /** Scheme applied to the page body when a section doesn't pick one. */
  defaultScheme: slug,
  typeset: TypesetSchema,
  space: SpaceScaleSchema.default(SpaceScaleSchema.parse({})),
  shape: ShapeSchema.default(ShapeSchema.parse({})),
  buttons: z.array(ButtonStyleSchema).min(1),
  defaultButton: slug,
  motion: MotionSchema.default(MotionSchema.parse({})),
  flavor: FlavorRefSchema.default(FlavorRefSchema.parse({})),
});
export type Theme = z.infer<typeof ThemeSchema>;
export type ThemeInput = z.input<typeof ThemeSchema>;

export function defineTheme(input: ThemeInput): Theme {
  return ThemeSchema.parse(input);
}

export type SchemeInput = z.input<typeof SchemeSchema>;
