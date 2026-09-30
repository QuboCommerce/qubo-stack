import type { Config, Field, Fields } from "@puckeditor/core";
import type { Theme } from "@peltier/stylekit";
import { buttonEmphases, fontRoles } from "@peltier/stylekit";
import type { Capability } from "./context";
import { blockCategories, type BlockDefinition, type BlockRegistry } from "./define";
import { anchorPoints, defaultsOf, linkKinds, type AnyFieldDef, type FieldKind, type FieldMap } from "./fields";

export type FieldAdapterContext = {
  theme?: Theme;
  /** `builder` sees builder-only fields (art, locks…). */
  audience: "merchant" | "builder";
};

/** Override how a field kind is edited (Plan B plugs shadcn custom fields in here). */
export type FieldAdapters = Partial<{ [K in FieldKind]: (def: Extract<AnyFieldDef, { kind: K }>, ctx: FieldAdapterContext) => Field }>;

const opt = (value: string, label: string) => ({ value, label });

function editorField(def: AnyFieldDef, ctx: FieldAdapterContext, adapters: FieldAdapters): Field {
  const custom = adapters[def.kind] as ((d: AnyFieldDef, c: FieldAdapterContext) => Field) | undefined;
  if (custom) return custom(def, ctx);
  const label = def.meta.label;
  switch (def.kind) {
    case "text":
      return { type: def.multiline ? "textarea" : "text", label, contentEditable: true, ...(def.meta.placeholder ? { placeholder: def.meta.placeholder } : {}) };
    case "richtext":
      return { type: "richtext", label, contentEditable: true };
    case "number":
      return { type: "number", label: def.unit ? `${label} (${def.unit})` : label, ...(def.min !== undefined ? { min: def.min } : {}), ...(def.max !== undefined ? { max: def.max } : {}), ...(def.step !== undefined ? { step: def.step } : {}) };
    case "toggle":
      return { type: "radio", label, options: [{ label: "On", value: true }, { label: "Off", value: false }] };
    case "select":
      return { type: def.display === "select" ? "select" : "radio", label, options: def.options.map((o) => opt(o.value, o.label)) };
    case "step":
      return { type: "select", label, options: def.steps.map((s) => opt(s, def.scale === "type" ? `Step ${s}` : s)) };
    case "anchor":
      return { type: "select", label, options: anchorPoints.map((a) => opt(a, a.replace("-", " "))) };
    case "scheme":
      return { type: "select", label, options: [opt("", "Inherit"), ...(ctx.theme?.schemes ?? []).map((s) => opt(s.id, s.name))] };
    case "token":
      return { type: "select", label, options: [opt("", "None"), ...(ctx.theme?.palette ?? []).map((t) => opt(t.id, t.name))] };
    case "fontRole":
      return { type: "select", label, options: fontRoles.map((r) => opt(r, r)) };
    case "buttonStyle":
      return { type: "select", label, options: [opt("", "Theme default"), ...(ctx.theme?.buttons ?? []).map((b) => opt(b.id, b.name))] };
    case "emphasis":
      return { type: "select", label, options: buttonEmphases.map((e) => opt(e, e)) };
    case "icon":
    case "anchorId":
      return { type: "text", label };
    case "media":
      return {
        type: "object",
        label,
        objectFields: { url: { type: "text", label: "URL" }, alt: { type: "text", label: "Alt text" } },
      };
    case "link":
      return {
        type: "object",
        label,
        objectFields: {
          kind: { type: "select", label: "Type", options: linkKinds.map((k) => opt(k, k)) },
          value: { type: "text", label: "Target" },
          newTab: { type: "radio", label: "New tab", options: [{ label: "Yes", value: true }, { label: "No", value: false }] },
        },
      };
    case "slot":
      return { type: "slot", label, ...(def.allow ? { allow: def.allow } : {}), ...(def.disallow ? { disallow: def.disallow } : {}) };
    case "list": {
      const summary = def.summary;
      return {
        type: "array",
        label,
        arrayFields: toPuckFields(def.item, "editor", ctx, adapters),
        defaultItemProps: defaultsOf(def.item),
        getItemSummary: (item: Record<string, unknown>, i?: number) =>
          (summary && typeof item[summary] === "string" && (item[summary] as string)) || `${def.itemLabel} ${(i ?? 0) + 1}`,
        ...(def.min !== undefined ? { min: def.min } : {}),
        ...(def.max !== undefined ? { max: def.max } : {}),
      } as Field;
    }
    case "group":
      return { type: "object", label, objectFields: toPuckFields(def.fields, "editor", ctx, adapters) };
    case "responsive":
      return {
        type: "object",
        label,
        objectFields: {
          base: editorField(def.inner, ctx, adapters),
          md: { ...editorField(def.inner, ctx, adapters), label: "Tablet (≥768px)" },
          lg: { ...editorField(def.inner, ctx, adapters), label: "Desktop (≥1024px)" },
        },
      } as Field;
  }
}

/** Only what Puck's renderer needs: slots, richtext and their containers. */
function renderField(def: AnyFieldDef): Field | null {
  switch (def.kind) {
    case "slot":
      return { type: "slot" };
    case "richtext":
      return { type: "richtext" };
    case "list": {
      const inner = structuralFields(def.item);
      return inner ? { type: "array", arrayFields: inner } : null;
    }
    case "group": {
      const inner = structuralFields(def.fields);
      return inner ? { type: "object", objectFields: inner } : null;
    }
    default:
      return null;
  }
}

function structuralFields(fields: FieldMap): Fields | null {
  const out: Fields = {};
  for (const [key, def] of Object.entries(fields)) {
    const field = renderField(def);
    if (field) out[key] = field;
  }
  return Object.keys(out).length ? out : null;
}

export function toPuckFields(fields: FieldMap, mode: "editor" | "render", ctx: FieldAdapterContext = { audience: "merchant" }, adapters: FieldAdapters = {}): Fields {
  if (mode === "render") return structuralFields(fields) ?? {};
  const out: Fields = {};
  const order: Record<string, number> = { content: 0, layout: 1, style: 2, advanced: 3 };
  const entries = Object.entries(fields)
    .filter(([, def]) => ctx.audience === "builder" || def.meta.audience !== "builder")
    .sort(([, a], [, b]) => (order[a.meta.group ?? "content"] ?? 0) - (order[b.meta.group ?? "content"] ?? 0));
  for (const [key, def] of entries) out[key] = editorField(def, ctx, adapters);
  return out;
}

export type PuckConfigOptions = {
  mode: "editor" | "render";
  capabilities?: readonly Capability[];
  fieldContext?: FieldAdapterContext;
  adapters?: FieldAdapters;
  root?: Config["root"];
};

export function toPuckConfig(registry: BlockRegistry, opts: PuckConfigOptions): Config {
  const defs = opts.mode === "editor" && opts.capabilities ? registry.list({ capabilities: opts.capabilities }) : registry.list();
  const components: Config["components"] = {};
  for (const def of defs) components[def.name] = componentConfig(def, opts);
  const categories: NonNullable<Config["categories"]> = {};
  for (const [key, title] of Object.entries(blockCategories)) {
    const names = defs.filter((d) => d.category === key).map((d) => d.name);
    if (names.length) categories[key] = { title, components: names, defaultExpanded: key !== "layout" };
  }
  return { components, categories, ...(opts.root ? { root: opts.root } : {}) } as Config;
}

function componentConfig(def: BlockDefinition, opts: PuckConfigOptions) {
  const fieldCtx = opts.fieldContext ?? { audience: "merchant" as const };
  return {
    label: def.label,
    fields: toPuckFields(def.fields, opts.mode, fieldCtx, opts.adapters),
    defaultProps: structuredClone(def.defaults),
    metadata: { block: { name: def.name, kind: def.kind, category: def.category, description: def.description, version: def.version } },
    // Locked sections (builder setting) can't be moved/deleted by merchants.
    resolvePermissions: (data: { props: Record<string, unknown> }) => {
      const locked = (data.props?.section as { locked?: boolean } | undefined)?.locked;
      return locked && fieldCtx.audience !== "builder" ? { delete: false, drag: false, duplicate: false } : {};
    },
    render: def.component as (props: Record<string, unknown>) => React.JSX.Element,
  };
}
