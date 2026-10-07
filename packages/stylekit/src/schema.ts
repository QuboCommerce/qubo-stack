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
  /** Inner shadow: a 1px inset highlight is what sells a metal surface. */
  inset: z.boolean().default(false),
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

export const entrancePresets = ["none", "fade", "rise", "scale", "blur", "mask", "slide"] as const;
export type EntrancePreset = (typeof entrancePresets)[number];

/** Named curves offered next to a free cubic-bezier input. */
export const easingPresets = {
  standard: "cubic-bezier(0.2, 0.8, 0.2, 1)",
  gentle: "cubic-bezier(0.32, 0.72, 0, 1)",
  snappy: "cubic-bezier(0.5, 0, 0.1, 1)",
  linear: "linear",
  "ease-in-out": "cubic-bezier(0.65, 0, 0.35, 1)",
  overshoot: "cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;

/** A colour taken from the scheme the effect sits in, so presets recolour per section. */
export const PaintSchema = z.object({
  role: z.enum(roles).default("primary"),
  alpha: z.number().min(0).max(1).default(1),
});
export type Paint = z.infer<typeof PaintSchema>;

const ms = (max: number, d: number) => z.number().int().min(0).max(max).default(d);

/**
 * Page transition preset. The overlay covers the page on leave, holds until
 * the next page has painted and `minVisible` has passed, then uncovers.
 */
export const transitionBackgrounds = ["solid", "translucent", "radial"] as const;
export const transitionMoves = ["fade", "slide-up", "slide-down", "wipe", "circle"] as const;
export const transitionIcons = ["none", "mark", "logo"] as const;
export const iconMotions = ["none", "pulse", "rotate", "line", "dots"] as const;

export const TransitionSchema = z.object({
  id: slug,
  name: z.string().min(1),
  background: z.enum(transitionBackgrounds).default("solid"),
  color: PaintSchema.default({ role: "background", alpha: 1 }),
  /** Backdrop blur for `translucent`, px. */
  blur: z.number().min(0).max(40).default(12),
  move: z.enum(transitionMoves).default("fade"),
  icon: z.enum(transitionIcons).default("none"),
  /** Icon size relative to 64px. */
  iconScale: z.number().min(0.25).max(4).default(1),
  iconRotation: z.number().min(-180).max(180).default(0),
  iconMotion: z.enum(iconMotions).default("pulse"),
  durationIn: ms(3000, 300),
  durationOut: ms(3000, 400),
  /** The overlay stays at least this long once fully covering (avoids a flash). */
  minVisible: ms(5000, 0),
  /** Empty = the theme easing. */
  easing: z.string().default(""),
});
export type Transition = z.infer<typeof TransitionSchema>;

export const builtInTransitions: z.input<typeof TransitionSchema>[] = [
  { id: "translucent", name: "Translucent veil", background: "translucent", color: { role: "background", alpha: 0.55 }, move: "fade", durationIn: 220, durationOut: 320 },
  { id: "icon", name: "Brand glow", background: "radial", color: { role: "primary", alpha: 1 }, move: "fade", icon: "mark", iconMotion: "pulse", durationIn: 300, durationOut: 450, minVisible: 400 },
  { id: "fullscreen", name: "Full cover", background: "solid", color: { role: "primary", alpha: 1 }, move: "slide-up", icon: "mark", iconMotion: "rotate", durationIn: 450, durationOut: 500, minVisible: 500, easing: easingPresets.gentle },
];

export const navMoves = ["slide", "fade", "scale", "circle"] as const;
export type NavMove = (typeof navMoves)[number];

export const MotionSchema = z.object({
  profile: z.enum(["none", "subtle", "lively"]).default("subtle"),
  durationFast: z.number().min(0).max(2000).default(150),
  durationBase: z.number().min(0).max(4000).default(300),
  durationSlow: z.number().min(0).max(6000).default(600),
  easing: z.string().default("cubic-bezier(0.2, 0.8, 0.2, 1)"),
  entrance: z.enum(entrancePresets).default("fade"),
  /**
   * `""` none, `"native"` the browser's cross-document view transition (no
   * overlay, no JavaScript), otherwise a preset id.
   */
  transition: z.string().default(""),
  transitions: z.array(TransitionSchema).default(() => builtInTransitions.map((t) => TransitionSchema.parse(t))),
  /** Mobile menu, sheets and fullscreen navigation. Enter and exit are set separately. */
  nav: z
    .object({
      enter: z.enum(navMoves).default("slide"),
      exit: z.enum(navMoves).default("fade"),
      durationIn: ms(2000, 380),
      durationOut: ms(2000, 220),
    })
    .default({ enter: "slide", exit: "fade", durationIn: 380, durationOut: 220 }),
});
export type Motion = z.infer<typeof MotionSchema>;

// ------------------------------------------------------------------ brand ---

/** Same shape as a block media value, so the studio media picker fills it. */
export const BrandAssetSchema = z.object({
  assetId: z.string().optional(),
  url: z.string().optional(),
  alt: z.string().default(""),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
export type BrandAsset = z.infer<typeof BrandAssetSchema>;

export const BrandSchema = z.object({
  /** Full logo for light backgrounds. */
  logo: BrandAssetSchema.nullable().default(null),
  /** Logo for dark backgrounds; falls back to `logo`. */
  logoInverse: BrandAssetSchema.nullable().default(null),
  /** Square symbol: transitions, loading states, favicon fallback. */
  mark: BrandAssetSchema.nullable().default(null),
  favicon: BrandAssetSchema.nullable().default(null),
  /** Default social sharing image (1200x630). */
  ogImage: BrandAssetSchema.nullable().default(null),
  /** Guidance for copy, read by people and by the AI. */
  voice: z
    .object({
      tone: z.string().default(""),
      avoid: z.array(z.string()).default([]),
    })
    .default({ tone: "", avoid: [] }),
});
export type Brand = z.infer<typeof BrandSchema>;

// --------------------------------------------------------------- surfaces ---

/** `stripes` repeats the stops every `size` px along `angle`: hairline textures such as brushed metal, ruled paper, scanlines. */
export const gradientKinds = ["linear", "radial", "conic", "stripes"] as const;

export const GradientStopSchema = PaintSchema.extend({ at: z.number().min(0).max(100) });

export const GradientSchema = z.object({
  id: slug,
  name: z.string().min(1),
  kind: z.enum(gradientKinds).default("linear"),
  /** Degrees for linear/conic; ignored by radial. */
  angle: z.number().min(0).max(360).default(180),
  /** Radial centre, % of the box. */
  x: z.number().min(0).max(100).default(50),
  y: z.number().min(0).max(100).default(0),
  /** Period in px for `stripes`; stop positions are percentages of it. */
  size: z.number().min(2).max(64).default(4),
  stops: z.array(GradientStopSchema).min(2).max(6),
});
export type Gradient = z.infer<typeof GradientSchema>;

export const builtInGradients: z.input<typeof GradientSchema>[] = [
  { id: "glow", name: "Soft glow from above", kind: "radial", x: 50, y: 0, stops: [{ role: "primary", alpha: 0.22, at: 0 }, { role: "background", alpha: 0, at: 70 }] },
  { id: "fade-down", name: "Fade into the next section", kind: "linear", angle: 180, stops: [{ role: "background", alpha: 1, at: 0 }, { role: "backgroundAlt", alpha: 1, at: 100 }] },
  { id: "accent-wash", name: "Accent wash", kind: "linear", angle: 135, stops: [{ role: "accent", alpha: 0.16, at: 0 }, { role: "background", alpha: 0, at: 60 }] },
  { id: "brushed-lines", name: "Brushed lines", kind: "stripes", angle: 0, size: 3, stops: [{ role: "text", alpha: 0.05, at: 0 }, { role: "text", alpha: 0.05, at: 34 }, { role: "text", alpha: 0, at: 34 }, { role: "text", alpha: 0, at: 100 }] },
];

export const SurfacesSchema = z.object({
  gradients: z.array(GradientSchema).default(() => builtInGradients.map((g) => GradientSchema.parse(g))),
});
export type Surfaces = z.infer<typeof SurfacesSchema>;

// ------------------------------------------------------------------ decor ---

/** Ways to mark words inside a heading; applied to character ranges per locale. */
export const decorKinds = ["color", "underline", "squiggle", "stroke", "box", "circle", "marker", "gradient"] as const;
export type DecorKind = (typeof decorKinds)[number];

export const DecorSchema = z.object({
  id: slug,
  name: z.string().min(1),
  kind: z.enum(decorKinds),
  color: PaintSchema.default({ role: "accentText", alpha: 1 }),
  /** Line weight in px (underline, squiggle, box, circle). */
  thickness: z.number().min(1).max(16).default(3),
  /** Also paint the words themselves in `color`. */
  tintText: z.boolean().default(false),
  /** Draw the mark in when the heading scrolls into view. */
  animate: z.boolean().default(true),
});
export type Decor = z.infer<typeof DecorSchema>;

export const builtInDecor: z.input<typeof DecorSchema>[] = [
  { id: "accent", name: "Accent colour", kind: "color", animate: false },
  { id: "squiggle", name: "Squiggle", kind: "squiggle", thickness: 3 },
  { id: "brush", name: "Brush stroke", kind: "stroke", color: { role: "accent", alpha: 0.85 } },
  { id: "box", name: "Box", kind: "box", thickness: 2 },
  { id: "circle", name: "Hand-drawn circle", kind: "circle", thickness: 3 },
  { id: "marker", name: "Marker", kind: "marker", color: { role: "accent", alpha: 0.35 } },
  { id: "underline", name: "Underline", kind: "underline", thickness: 4 },
  { id: "gradient", name: "Gradient fill", kind: "gradient", color: { role: "primary", alpha: 1 } },
];

// ---------------------------------------------------------------- effects ---

export const effectKinds = ["snow", "particles", "aurora", "grain"] as const;
export type EffectKind = (typeof effectKinds)[number];

export const EffectSchema = z.object({
  id: slug,
  name: z.string().min(1),
  kind: z.enum(effectKinds),
  color: PaintSchema.default({ role: "text", alpha: 0.8 }),
  /** 1..100, particles per 100k px² for snow/particles. */
  density: z.number().min(1).max(100).default(30),
  speed: z.number().min(0.1).max(4).default(1),
  /** Particle size multiplier. */
  size: z.number().min(0.25).max(4).default(1),
});
export type Effect = z.infer<typeof EffectSchema>;

export const builtInEffects: z.input<typeof EffectSchema>[] = [
  { id: "first-snow", name: "First snow", kind: "snow", color: { role: "background", alpha: 0.9 }, density: 25, speed: 0.8 },
  { id: "drift", name: "Slow drift", kind: "particles", color: { role: "accentText", alpha: 0.5 }, density: 12, speed: 0.5 },
  { id: "northern-light", name: "Northern light", kind: "aurora", color: { role: "accent", alpha: 0.35 }, speed: 0.6 },
  { id: "film-grain", name: "Film grain", kind: "grain", color: { role: "text", alpha: 0.08 } },
];

export const EffectsSchema = z.object({
  presets: z.array(EffectSchema).default(() => builtInEffects.map((e) => EffectSchema.parse(e))),
  /** Site-wide effect id over every page; pages and sections can override. */
  active: z.string().default(""),
  /** Only run the site-wide effect between these dates (MM-DD, wraps the new year). */
  schedule: z
    .object({ enabled: z.boolean().default(false), from: z.string().regex(/^\d{2}-\d{2}$/).default("12-01"), to: z.string().regex(/^\d{2}-\d{2}$/).default("01-06") })
    .default({ enabled: false, from: "12-01", to: "01-06" }),
});
export type Effects = z.infer<typeof EffectsSchema>;

// ------------------------------------------------------------------- kits ---

/**
 * A section kit the theme turns on: an art-directed block family with its own
 * stylesheet (see `@qubo/blocks` kits). `assets` fill the kit's image
 * variables, keyed by the names the kit declares.
 */
export const KitRefSchema = z.object({
  id: slug,
  assets: z.record(z.string(), BrandAssetSchema).default({}),
});
export type KitRef = z.infer<typeof KitRefSchema>;

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
  motion: MotionSchema.default(() => MotionSchema.parse({})),
  brand: BrandSchema.default(() => BrandSchema.parse({})),
  surfaces: SurfacesSchema.default(() => SurfacesSchema.parse({})),
  decor: z.array(DecorSchema).default(() => builtInDecor.map((d) => DecorSchema.parse(d))),
  effects: EffectsSchema.default(() => EffectsSchema.parse({})),
  flavor: FlavorRefSchema.default(FlavorRefSchema.parse({})),
  kits: z.array(KitRefSchema).default([]),
});
export type Theme = z.infer<typeof ThemeSchema>;
export type ThemeInput = z.input<typeof ThemeSchema>;

export function defineTheme(input: ThemeInput): Theme {
  return ThemeSchema.parse(input);
}

export type SchemeInput = z.input<typeof SchemeSchema>;
