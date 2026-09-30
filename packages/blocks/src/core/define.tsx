import type { ReactNode } from "react";
import type { z } from "zod";
import { SectionChrome, sectionChrome, sectionChromeFields, type SectionChromeValue } from "./chrome";
import type { BlockContext, Capability, RenderMetadata } from "./context";
import {
  defaultsOf,
  f,
  fillDefaults,
  objectSchema,
  type AnyFieldDef,
  type FieldMap,
  type GroupDef,
  type InferValues,
  type ListDef,
  type RichtextDef,
  type SlotDef,
} from "./fields";

export const blockCategories = {
  layout: "Layout",
  elements: "Elements",
  sections: "Sections",
  commerce: "Shop",
  booking: "Booking",
  leads: "Leads",
  blog: "Blog",
  site: "Site",
} as const;
export type BlockCategory = keyof typeof blockCategories;

/** section = top-level page band with chrome; element/layout = composable inside slots. */
export type BlockKind = "section" | "element" | "layout";

/** Matches Puck's slot render function. */
export type SlotRender = (props?: {
  className?: string;
  style?: React.CSSProperties;
  minEmptyHeight?: number | string;
  allow?: string[];
  disallow?: string[];
  as?: React.ElementType;
}) => ReactNode;

type RenderValue<D extends AnyFieldDef> = D extends SlotDef
  ? SlotRender
  : D extends RichtextDef
    ? ReactNode
    : D extends ListDef<infer F>
      ? RenderValues<F>[]
      : D extends GroupDef<infer F>
        ? RenderValues<F>
        : D["default"];

/** Props as a block's render function receives them (slots are components, richtext is nodes). */
export type RenderValues<F extends FieldMap> = { [K in keyof F]: RenderValue<F[K]> };

type DeepPartial<T> = T extends unknown[] ? T : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

export type BlockPreset<F extends FieldMap = FieldMap> = {
  id: string;
  label: string;
  description?: string;
  props: DeepPartial<InferValues<F>>;
};

export type BlockInput<F extends FieldMap> = {
  /** PascalCase component type stored in documents. Never rename once shipped. */
  name: string;
  label: string;
  /** One sentence; shown in the add-block modal and given to the AI. */
  description: string;
  category: BlockCategory;
  icon?: string;
  keywords?: string[];
  /** Bump when the props shape changes and add a migration. */
  version?: number;
  requires?: Capability[];
  fields: F;
  presets?: BlockPreset<F>[];
  /** version → upgrade props from (version - 1) to version. */
  migrate?: Record<number, (props: Record<string, unknown>) => Record<string, unknown>>;
  render: (props: RenderValues<F> & { id: string }, ctx: BlockContext) => ReactNode;
};

export type BlockDefinition<F extends FieldMap = FieldMap> = Omit<BlockInput<F>, "render" | "version" | "presets"> & {
  kind: BlockKind;
  version: number;
  presets: BlockPreset<F>[];
  schema: z.ZodType<InferValues<F>>;
  defaults: InferValues<F> & { _v: number };
  /** Puck-shaped render: receives raw Puck props (with `puck`). */
  component: (props: Record<string, unknown>) => ReactNode;
};

type PuckProps = Record<string, unknown> & {
  id?: string;
  puck?: { metadata?: RenderMetadata; isEditing?: boolean };
};

function contextFrom(props: PuckProps): BlockContext {
  return {
    id: props.id ?? "",
    isEditing: props.puck?.isEditing ?? false,
    metadata: props.puck?.metadata ?? {},
  };
}

function build<F extends FieldMap>(input: BlockInput<F>, kind: BlockKind, wrap?: (props: PuckProps, ctx: BlockContext, inner: ReactNode) => ReactNode): BlockDefinition<F> {
  const version = input.version ?? 1;
  const { render, ...rest } = input;
  const component = (raw: Record<string, unknown>) => {
    // Fill props missing from older documents / partial preset children so
    // render functions can rely on every declared field being present.
    const props = fillDefaults(input.fields, raw) as PuckProps;
    const ctx = contextFrom(props);
    const inner = render(props as unknown as RenderValues<F> & { id: string }, ctx);
    return wrap ? wrap(props, ctx, inner) : inner;
  };
  return {
    ...rest,
    kind,
    version,
    presets: input.presets ?? [],
    schema: objectSchema(input.fields) as unknown as z.ZodType<InferValues<F>>,
    defaults: { ...defaultsOf(input.fields), _v: version },
    component,
  };
}

/** An element or layout primitive — composable inside slots. */
export function defineBlock<F extends FieldMap>(input: BlockInput<F> & { kind?: Exclude<BlockKind, "section"> }) {
  return build(input, input.kind ?? "element");
}

/**
 * A page section: gains the Section Chrome (`section` prop) automatically.
 * `chrome` overrides the chrome defaults for this section type only.
 */
export function defineSection<F extends FieldMap>(
  input: Omit<BlockInput<F>, "presets"> & {
    chrome?: DeepPartial<SectionChromeValue>;
    presets?: BlockPreset<F & { section: typeof sectionChrome }>[];
  },
) {
  const { chrome: chromeDefaults, ...rest } = input;
  const chrome = chromeDefaults
    ? f.group(sectionChromeFields, {
        label: "Section",
        collapsed: false,
        default: deepMerge(sectionChrome.default, chromeDefaults),
      })
    : sectionChrome;
  input = rest as BlockInput<F>;
  const fields = { ...input.fields, section: chrome };
  return build<F & { section: typeof sectionChrome }>(
    { ...input, fields } as unknown as BlockInput<F & { section: typeof sectionChrome }>,
    "section",
    (props, ctx, inner) => (
      <SectionChrome type={input.name} value={props.section as never} ctx={ctx}>
        {inner}
      </SectionChrome>
    ),
  );
}

// ------------------------------------------------------------- registry ---

export type BlockRegistry = {
  blocks: Record<string, BlockDefinition>;
  get(name: string): BlockDefinition | undefined;
  list(filter?: { capabilities?: readonly Capability[]; kind?: BlockKind }): BlockDefinition[];
};

export function createRegistry(defs: BlockDefinition<any>[]): BlockRegistry {
  const blocks: Record<string, BlockDefinition> = {};
  for (const def of defs) {
    if (blocks[def.name]) throw new Error(`Duplicate block name "${def.name}"`);
    blocks[def.name] = def as BlockDefinition;
  }
  return {
    blocks,
    get: (name) => blocks[name],
    list: (filter = {}) =>
      Object.values(blocks).filter(
        (b) =>
          (!filter.kind || b.kind === filter.kind) &&
          (!filter.capabilities || (b.requires ?? []).every((c) => filter.capabilities!.includes(c))),
      ),
  };
}

// --------------------------------------------------------------- nodes ---

let counter = 0;
export const newNodeId = (type: string) =>
  `${type}-${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function deepMerge<T>(base: T, patch: unknown): T {
  if (patch === undefined) return base;
  if (Array.isArray(patch) || patch === null || typeof patch !== "object") return patch as T;
  if (base === null || typeof base !== "object" || Array.isArray(base)) return patch as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch)) out[k] = deepMerge(out[k], v);
  return out as T;
}
