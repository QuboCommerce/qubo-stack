import { buttonEmphases, entrancePresets, fontRoles, spaceSteps, typeSteps } from "@peltier/stylekit";
import { z } from "zod";

/**
 * Field DSL.
 *
 * A block declares its fields once with `f.*`; from that single declaration we
 * derive the Zod schema (validation, migration, AI JSON schema), the default
 * props, the Puck editor fields, the blueprint placeholders and the
 * translation/asset walkers. Adding a field never means touching five files.
 */

export type FieldGroup = "content" | "layout" | "style" | "advanced";
/** `builder` fields are hidden from merchants (builder-only knobs). */
export type Audience = "merchant" | "builder";

export type FieldMeta = {
  label: string;
  /** Shown as help text and fed to the AI as the field's intent. */
  description?: string;
  group?: FieldGroup;
  audience?: Audience;
  placeholder?: string;
};

type Def<K extends string, T, X = {}> = {
  kind: K;
  schema: z.ZodType<T>;
  default: T;
  meta: FieldMeta;
} & X;

/**
 * `inline`: editable directly on the canvas. In the editor Puck then passes the
 * prop as a React element, so only enable it for copy rendered as children —
 * never for values used in attributes, URLs or string logic. Defaults to
 * `translatable`: non-translatable text is data (keys, URLs, addresses).
 */
export type TextDef = Def<"text", string, { multiline: boolean; translatable: boolean; inline: boolean; maxLength?: number }>;
export type RichtextDef = Def<"richtext", string, { translatable: boolean }>;
export type NumberDef = Def<"number", number, { min?: number; max?: number; step?: number; unit?: string }>;
export type ToggleDef = Def<"toggle", boolean>;
export type SelectOption<V extends string = string> = { value: V; label: string };
export type SelectDef<V extends string = string> = Def<
  "select",
  V,
  { options: readonly SelectOption<V>[]; display: "select" | "radio" | "segmented" }
>;
export type StepScale = "space" | "type";
export type StepDef = Def<"step", string, { scale: StepScale; steps: readonly string[] }>;
export const anchorPoints = [
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
] as const;
export type Anchor = (typeof anchorPoints)[number];
export type AnchorDef = Def<"anchor", Anchor>;
export type SchemeRefDef = Def<"scheme", string>;
export type TokenRefDef = Def<"token", string>;
export type FontRoleDef = Def<"fontRole", (typeof fontRoles)[number]>;
export type ButtonStyleDef = Def<"buttonStyle", string>;
export type EmphasisDef = Def<"emphasis", (typeof buttonEmphases)[number]>;
export type IconDef = Def<"icon", string>;
export type AnchorIdDef = Def<"anchorId", string>;

export type MediaValue = {
  /** Media-library asset (Supabase storage). Preferred. */
  assetId?: string;
  /** Plain URL — dev fixtures and external images. */
  url?: string;
  alt: string;
  /** Focal point, 0–1 on each axis, used for object-position. */
  focal?: { x: number; y: number };
};
export type MediaAccept = "image" | "video" | "any";
export type MediaDef = Def<"media", MediaValue | null, { accept: MediaAccept; translatableAlt: boolean }>;

export const linkKinds = ["url", "page", "product", "collection", "anchor", "email", "phone"] as const;
export type LinkKind = (typeof linkKinds)[number];
export type LinkValue = { kind: LinkKind; value: string; newTab?: boolean };
export type LinkDef = Def<"link", LinkValue>;

export type SlotNode = { type: string; props: Record<string, unknown> & { id?: string } };
export type SlotContent = SlotNode[];
export type SlotDef = Def<"slot", SlotContent, { allow?: string[]; disallow?: string[] }>;

// Recursive defs are interfaces so TypeScript resolves them lazily.
export interface ListDef<F extends FieldMap = FieldMap> extends Def<"list", InferValues<F>[]> {
  item: F;
  min?: number;
  max?: number;
  summary?: keyof F & string;
  itemLabel: string;
}
export interface GroupDef<F extends FieldMap = FieldMap> extends Def<"group", InferValues<F>> {
  fields: F;
  collapsed: boolean;
}

export type Responsive<T> = { base: T; md?: T; lg?: T };
export interface ResponsiveDef<T = unknown> extends Def<"responsive", Responsive<T>> {
  inner: AnyFieldDef;
}

export type AnyFieldDef =
  | TextDef
  | RichtextDef
  | NumberDef
  | ToggleDef
  | SelectDef<any>
  | StepDef
  | AnchorDef
  | SchemeRefDef
  | TokenRefDef
  | FontRoleDef
  | ButtonStyleDef
  | EmphasisDef
  | IconDef
  | AnchorIdDef
  | MediaDef
  | LinkDef
  | SlotDef
  | ListDef<any>
  | GroupDef<any>
  | ResponsiveDef<any>;

export type FieldKind = AnyFieldDef["kind"];
// An interface (not a type alias) breaks the AnyFieldDef ↔ FieldMap cycle.
export interface FieldMap {
  [key: string]: AnyFieldDef;
}

/** Stored prop values (what lives in the document JSON). */
export type InferValues<F extends FieldMap> = { [K in keyof F]: F[K]["default"] };

// ------------------------------------------------------------- builders ---

type Opts<T, X = {}> = Partial<FieldMeta> & { default?: T } & X;

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const meta = (o: Partial<FieldMeta>, fallback: string): FieldMeta => {
  const m: FieldMeta = { label: o.label ?? fallback };
  if (o.description) m.description = o.description;
  if (o.group) m.group = o.group;
  if (o.audience) m.audience = o.audience;
  if (o.placeholder) m.placeholder = o.placeholder;
  return m;
};

const describe = <S extends z.ZodType>(schema: S, m: FieldMeta): S =>
  schema.meta({ title: m.label, ...(m.description ? { description: m.description } : {}) }) as S;

export const spaceStepNames = Object.keys(spaceSteps) as (keyof typeof spaceSteps)[];
export const typeStepNames = typeSteps.map(String);

const mediaSchema = z
  .object({
    assetId: z.string().optional(),
    url: z.string().optional(),
    alt: z.string().default(""),
    focal: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
  })
  .nullable();

const linkSchema = z.object({
  kind: z.enum(linkKinds),
  value: z.string(),
  newTab: z.boolean().optional(),
});

export const f = {
  text(o: Opts<string, { multiline?: boolean; translatable?: boolean; inline?: boolean; maxLength?: number }> = {}): TextDef {
    const m = meta(o, "Text");
    let s = z.string();
    if (o.maxLength) s = s.max(o.maxLength);
    const def: TextDef = {
      kind: "text",
      schema: describe(s, m),
      default: o.default ?? "",
      meta: { group: "content", ...m },
      multiline: o.multiline ?? false,
      translatable: o.translatable ?? true,
      inline: o.inline ?? o.translatable ?? true,
    };
    if (o.maxLength) def.maxLength = o.maxLength;
    return def;
  },

  /** Rich text (Puck's Tiptap field). Stored as HTML; rendered as React nodes. */
  richtext(o: Opts<string, { translatable?: boolean }> = {}): RichtextDef {
    const m = meta(o, "Text");
    return {
      kind: "richtext",
      schema: describe(z.string(), m),
      default: o.default ?? "",
      meta: { group: "content", ...m },
      translatable: o.translatable ?? true,
    };
  },

  number(o: Opts<number, { min?: number; max?: number; step?: number; unit?: string }> = {}): NumberDef {
    const m = meta(o, "Number");
    let s = z.number();
    if (o.min !== undefined) s = s.min(o.min);
    if (o.max !== undefined) s = s.max(o.max);
    return {
      kind: "number",
      schema: describe(s, m),
      default: o.default ?? o.min ?? 0,
      meta: m,
      ...(o.min !== undefined ? { min: o.min } : {}),
      ...(o.max !== undefined ? { max: o.max } : {}),
      ...(o.step !== undefined ? { step: o.step } : {}),
      ...(o.unit !== undefined ? { unit: o.unit } : {}),
    };
  },

  toggle(o: Opts<boolean> = {}): ToggleDef {
    const m = meta(o, "Enabled");
    return { kind: "toggle", schema: describe(z.boolean(), m), default: o.default ?? false, meta: m };
  },

  select<const V extends string>(
    options: readonly (V | SelectOption<V>)[],
    o: Opts<V, { display?: SelectDef["display"] }> = {},
  ): SelectDef<V> {
    const m = meta(o, "Option");
    const opts = options.map((op) =>
      typeof op === "string" ? { value: op, label: titleCase(op.replace(/-/g, " ")) } : op,
    );
    const values = opts.map((op) => op.value) as [V, ...V[]];
    return {
      kind: "select",
      schema: describe(z.enum(values) as unknown as z.ZodType<V>, m),
      default: o.default ?? values[0],
      meta: m,
      options: opts,
      display: o.display ?? (opts.length <= 3 ? "segmented" : "select"),
    };
  },

  /** Discrete dotted slider over a theme scale — never a raw px value. */
  step(scale: StepScale, o: Opts<string, { min?: string; max?: string }> = {}): StepDef {
    const all: readonly string[] = scale === "space" ? spaceStepNames : typeStepNames;
    const from = o.min ? all.indexOf(o.min) : 0;
    const to = o.max ? all.indexOf(o.max) : all.length - 1;
    const steps = all.slice(Math.max(0, from), to + 1);
    const m = meta(o, scale === "space" ? "Spacing" : "Size");
    return {
      kind: "step",
      schema: describe(z.enum(steps as [string, ...string[]]), m),
      default: o.default ?? steps[Math.floor(steps.length / 2)]!,
      meta: { group: "layout", ...m },
      scale,
      steps,
    };
  },

  /** Figma-style 9-point alignment. */
  anchor(o: Opts<Anchor> = {}): AnchorDef {
    const m = meta(o, "Alignment");
    return {
      kind: "anchor",
      schema: describe(z.enum(anchorPoints), m),
      default: o.default ?? "center",
      meta: { group: "layout", ...m },
    };
  },

  /** A color scheme id from the active theme; "" inherits from the parent. */
  scheme(o: Opts<string> = {}): SchemeRefDef {
    const m = meta(o, "Color scheme");
    return { kind: "scheme", schema: describe(z.string(), m), default: o.default ?? "", meta: { group: "style", ...m } };
  },

  token(o: Opts<string> = {}): TokenRefDef {
    const m = meta(o, "Color");
    return { kind: "token", schema: describe(z.string(), m), default: o.default ?? "", meta: { group: "style", ...m } };
  },

  fontRole(o: Opts<(typeof fontRoles)[number]> = {}): FontRoleDef {
    const m = meta(o, "Font");
    return {
      kind: "fontRole",
      schema: describe(z.enum(fontRoles), m),
      default: o.default ?? "body",
      meta: { group: "style", ...m },
    };
  },

  /** Button style id from the theme; "" = theme default. */
  buttonStyle(o: Opts<string> = {}): ButtonStyleDef {
    const m = meta(o, "Button style");
    return {
      kind: "buttonStyle",
      schema: describe(z.string(), m),
      default: o.default ?? "",
      meta: { group: "style", ...m },
    };
  },

  emphasis(o: Opts<(typeof buttonEmphases)[number]> = {}): EmphasisDef {
    const m = meta(o, "Emphasis");
    return {
      kind: "emphasis",
      schema: describe(z.enum(buttonEmphases), m),
      default: o.default ?? "primary",
      meta: { group: "style", ...m },
    };
  },

  icon(o: Opts<string> = {}): IconDef {
    const m = meta(o, "Icon");
    return { kind: "icon", schema: describe(z.string(), m), default: o.default ?? "", meta: { group: "content", ...m } };
  },

  /** HTML id for in-page links (`#faq`). */
  anchorId(o: Opts<string> = {}): AnchorIdDef {
    const m = meta(o, "Section id");
    return {
      kind: "anchorId",
      schema: describe(z.string().regex(/^([a-z][a-z0-9-]*)?$/, "lowercase letters, digits and dashes"), m),
      default: o.default ?? "",
      meta: { group: "advanced", description: "Link to this section with #id.", ...m },
    };
  },

  media(o: Opts<MediaValue | null, { accept?: MediaAccept; translatableAlt?: boolean }> = {}): MediaDef {
    const m = meta(o, o.accept === "video" ? "Video" : "Image");
    return {
      kind: "media",
      schema: describe(mediaSchema, m) as z.ZodType<MediaValue | null>,
      default: o.default ?? { alt: "" },
      meta: { group: "content", ...m },
      accept: o.accept ?? "image",
      translatableAlt: o.translatableAlt ?? true,
    };
  },

  link(o: Opts<LinkValue> = {}): LinkDef {
    const m = meta(o, "Link");
    return {
      kind: "link",
      schema: describe(linkSchema, m) as z.ZodType<LinkValue>,
      default: o.default ?? { kind: "url", value: "" },
      meta: { group: "content", ...m },
    };
  },

  /** Nested block area (Puck slot). */
  slot(o: Opts<SlotContent, { allow?: string[]; disallow?: string[] }> = {}): SlotDef {
    const m = meta(o, "Content");
    const node = z.looseObject({ type: z.string(), props: z.record(z.string(), z.unknown()) });
    return {
      kind: "slot",
      schema: describe(z.array(node), m) as unknown as z.ZodType<SlotContent>,
      default: o.default ?? [],
      meta: { group: "content", ...m },
      ...(o.allow ? { allow: o.allow } : {}),
      ...(o.disallow ? { disallow: o.disallow } : {}),
    };
  },

  /** Default items may be partial; missing props are filled from item field defaults. */
  list<F extends FieldMap>(
    item: F,
    o: Opts<Partial<InferValues<F>>[], { min?: number; max?: number; summary?: keyof F & string; itemLabel?: string }> = {},
  ): ListDef<F> {
    const m = meta(o, "Items");
    let s = z.array(objectSchema(item));
    if (o.min !== undefined) s = s.min(o.min);
    if (o.max !== undefined) s = s.max(o.max);
    return {
      kind: "list",
      schema: describe(s, m) as unknown as z.ZodType<InferValues<F>[]>,
      default: (o.default ?? []).map((it) => ({ ...defaultsOf(item), ...it })) as InferValues<F>[],
      meta: { group: "content", ...m },
      item,
      itemLabel: o.itemLabel ?? "Item",
      ...(o.min !== undefined ? { min: o.min } : {}),
      ...(o.max !== undefined ? { max: o.max } : {}),
      ...(o.summary !== undefined ? { summary: o.summary } : {}),
    };
  },

  group<F extends FieldMap>(fields: F, o: Opts<Partial<InferValues<F>>, { collapsed?: boolean }> = {}): GroupDef<F> {
    const m = meta(o, "Group");
    return {
      kind: "group",
      schema: describe(objectSchema(fields), m) as unknown as z.ZodType<InferValues<F>>,
      default: { ...defaultsOf(fields), ...(o.default ?? {}) } as InferValues<F>,
      meta: m,
      fields,
      collapsed: o.collapsed ?? true,
    };
  },

  /** Per-breakpoint value; `base` is mobile-first, md ≥768px, lg ≥1024px. */
  responsive<D extends AnyFieldDef>(inner: D, o: Opts<Responsive<D["default"]>> = {}): ResponsiveDef<D["default"]> {
    const m = meta(o, inner.meta.label);
    const s = z.object({ base: inner.schema, md: inner.schema.optional(), lg: inner.schema.optional() });
    return {
      kind: "responsive",
      schema: describe(s, m) as unknown as z.ZodType<Responsive<D["default"]>>,
      default: o.default ?? { base: inner.default },
      meta: { ...inner.meta, ...m },
      inner,
    };
  },
};

// ---------------------------------------------------------------- utils ---

/** Object schema that fills missing props from field defaults. */
export function objectSchema(fields: FieldMap) {
  const shape: Record<string, z.ZodType> = {};
  for (const [key, def] of Object.entries(fields)) {
    shape[key] = (def.schema as z.ZodType).default(() => structuredClone(def.default) as never);
  }
  return z.looseObject(shape);
}

export function defaultsOf<F extends FieldMap>(fields: F): InferValues<F> {
  const out: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(fields)) out[key] = structuredClone(def.default);
  return out as InferValues<F>;
}

/** Fills missing props (recursing into groups and list items) from field defaults. */
export function fillDefaults(fields: FieldMap, props: Record<string, unknown> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(props ?? {}) };
  for (const [key, def] of Object.entries(fields)) {
    const v = out[key];
    if (v === undefined) out[key] = structuredClone(def.default);
    else if (def.kind === "group" && v && typeof v === "object") out[key] = fillDefaults(def.fields, v as Record<string, unknown>);
    else if (def.kind === "list" && Array.isArray(v))
      out[key] = v.map((it) => (it && typeof it === "object" ? fillDefaults(def.item, it as Record<string, unknown>) : it));
  }
  return out;
}

export const isTranslatable = (def: AnyFieldDef) =>
  (def.kind === "text" || def.kind === "richtext") && def.translatable;

export const entranceOptions = ["inherit", ...entrancePresets] as const;
