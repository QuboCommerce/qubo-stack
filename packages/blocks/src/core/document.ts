import { deepMerge, newNodeId, type BlockDefinition, type BlockRegistry } from "./define";
import { fillDefaults, isTranslatable, type AnyFieldDef, type FieldMap, type MediaValue, type SlotContent, type SlotNode } from "./fields";

/** Puck document shape (subset we rely on). */
export type DocumentData = {
  root: { props?: Record<string, unknown> } & Record<string, unknown>;
  content: SlotContent;
  zones?: Record<string, SlotContent>;
};

export type NodeVisit = { node: SlotNode; parentId: string | null; slot: string | null; depth: number };

// --------------------------------------------------------- field walking ---

type FieldVisitor = (def: AnyFieldDef, value: unknown, path: string) => void;

/** Visits every field value of a props object, descending into lists, groups and responsive values. */
export function walkFields(fields: FieldMap, props: Record<string, unknown>, visit: FieldVisitor, prefix = "") {
  for (const [key, def] of Object.entries(fields)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const value = props?.[key];
    visit(def, value, path);
    if (def.kind === "list" && Array.isArray(value)) {
      value.forEach((item, i) => walkFields(def.item, item as Record<string, unknown>, visit, `${path}.${i}`));
    } else if (def.kind === "group" && value && typeof value === "object") {
      walkFields(def.fields, value as Record<string, unknown>, visit, path);
    } else if (def.kind === "responsive" && value && typeof value === "object") {
      for (const bp of ["base", "md", "lg"] as const) {
        const v = (value as Record<string, unknown>)[bp];
        if (v !== undefined) visit(def.inner, v, `${path}.${bp}`);
      }
    }
  }
}

function slotPaths(fields: FieldMap, props: Record<string, unknown>): { path: string; content: SlotContent }[] {
  const out: { path: string; content: SlotContent }[] = [];
  walkFields(fields, props, (def, value, path) => {
    if (def.kind === "slot" && Array.isArray(value)) out.push({ path, content: value as SlotContent });
  });
  return out;
}

export function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => (acc == null ? undefined : (acc as Record<string, unknown>)[k]), obj);
}

export function setPath<T>(obj: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split(".");
  const isIndex = /^\d+$/.test(head!);
  const source = (obj ?? (isIndex ? [] : {})) as Record<string, unknown> | unknown[];
  const copy = (Array.isArray(source) ? [...source] : { ...source }) as Record<string, unknown>;
  copy[head!] = rest.length ? setPath(copy[head!], rest.join("."), value) : value;
  return copy as T;
}

// ---------------------------------------------------------- node walking ---

export function walkNodes(data: DocumentData, registry: BlockRegistry, visit: (v: NodeVisit) => void) {
  const walk = (content: SlotContent, parentId: string | null, slot: string | null, depth: number) => {
    for (const node of content ?? []) {
      visit({ node, parentId, slot, depth });
      const def = registry.get(node.type);
      if (!def) continue;
      for (const s of slotPaths(def.fields, node.props)) walk(s.content, (node.props.id as string) ?? null, s.path, depth + 1);
    }
  };
  walk(data.content, null, null, 0);
  for (const [zone, content] of Object.entries(data.zones ?? {})) walk(content, zone.split(":")[0] ?? null, zone, 1);
}

/** Immutable node transform; children are transformed after their parent. */
export function mapNodes(data: DocumentData, registry: BlockRegistry, fn: (node: SlotNode, def: BlockDefinition | undefined) => SlotNode): DocumentData {
  const mapContent = (content: SlotContent): SlotContent =>
    (content ?? []).map((original) => {
      const def = registry.get(original.type);
      let node = fn(original, def);
      if (def) {
        for (const s of slotPaths(def.fields, node.props)) {
          node = { ...node, props: setPath(node.props, s.path, mapContent(s.content)) };
        }
      }
      return node;
    });
  const out: DocumentData = { ...data, content: mapContent(data.content) };
  if (data.zones) out.zones = Object.fromEntries(Object.entries(data.zones).map(([k, v]) => [k, mapContent(v)]));
  return out;
}

// ------------------------------------------------------------ lifecycle ---

export type ValidationIssue = { nodeId: string | null; type: string; path: string; message: string };

export function validateDocument(data: DocumentData, registry: BlockRegistry): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  if (!data || !Array.isArray(data.content)) {
    return [{ nodeId: null, type: "root", path: "content", message: "Document has no content array" }];
  }
  walkNodes(data, registry, ({ node }) => {
    const id = (node.props?.id as string | undefined) ?? null;
    if (!id) issues.push({ nodeId: null, type: node.type, path: "id", message: "Node is missing an id" });
    else if (ids.has(id)) issues.push({ nodeId: id, type: node.type, path: "id", message: `Duplicate node id "${id}"` });
    else ids.add(id);
    const def = registry.get(node.type);
    if (!def) {
      issues.push({ nodeId: id, type: node.type, path: "", message: `Unknown block type "${node.type}"` });
      return;
    }
    const result = def.schema.safeParse(node.props);
    if (!result.success) {
      for (const issue of result.error.issues) {
        issues.push({ nodeId: id, type: node.type, path: issue.path.join("."), message: issue.message });
      }
    }
  });
  return issues;
}

/**
 * Upgrades every node to its block's current version and fills props added
 * since the document was saved. Runs on load (editor) and on save (API).
 */
export function migrateDocument(data: DocumentData, registry: BlockRegistry): { data: DocumentData; changed: boolean } {
  let changed = false;
  const next = mapNodes(data, registry, (node, def) => {
    if (!def) return node;
    let props = { ...node.props };
    let v = typeof props._v === "number" ? props._v : 1;
    while (v < def.version) {
      const step = def.migrate?.[v + 1];
      if (step) props = step(props);
      v++;
    }
    const parsed = def.schema.safeParse(props);
    const filled = parsed.success ? (parsed.data as Record<string, unknown>) : fillDefaults(def.fields, props);
    filled._v = def.version;
    if (JSON.stringify(filled) !== JSON.stringify(node.props)) changed = true;
    return { ...node, props: filled };
  });
  return { data: next, changed };
}

/** Creates a node (and ids for any preset slot children) ready to insert. */
export function instantiate(registry: BlockRegistry, type: string, opts: { preset?: string; props?: Record<string, unknown> } = {}): SlotNode {
  const def = registry.get(type);
  if (!def) throw new Error(`Unknown block type "${type}"`);
  const preset = opts.preset ? def.presets.find((p) => p.id === opts.preset) : undefined;
  if (opts.preset && !preset) throw new Error(`Unknown preset "${opts.preset}" for ${type}`);
  let props = deepMerge(structuredClone(def.defaults) as Record<string, unknown>, preset?.props);
  props = { ...fillDefaults(def.fields, deepMerge(props, opts.props)), _v: def.version };
  const node: SlotNode = { type, props: { ...props, id: newNodeId(type) } };
  return withIds(node, registry);
}

/** Assigns ids to any id-less descendants (preset slot content). */
export function withIds(node: SlotNode, registry: BlockRegistry): SlotNode {
  const def = registry.get(node.type);
  let props = { ...node.props, id: node.props.id ?? newNodeId(node.type) };
  if (def) {
    for (const s of slotPaths(def.fields, props)) {
      props = setPath(
        props,
        s.path,
        s.content.map((child) => {
          const childDef = registry.get(child.type);
          const filled = childDef ? { ...fillDefaults(childDef.fields, child.props), _v: childDef.version } : child.props;
          return withIds({ ...child, props: filled }, registry);
        }),
      );
    }
  }
  return { ...node, props };
}

// --------------------------------------------------------------- assets ---

export type AssetReference = { assetId: string; nodeId: string; path: string };

export function collectAssetReferences(data: DocumentData, registry: BlockRegistry): AssetReference[] {
  const refs: AssetReference[] = [];
  walkNodes(data, registry, ({ node }) => {
    const def = registry.get(node.type);
    if (!def) return;
    walkFields(def.fields, node.props, (field, value, path) => {
      if (field.kind === "media" && value && (value as MediaValue).assetId) {
        refs.push({ assetId: (value as MediaValue).assetId!, nodeId: node.props.id as string, path });
      }
    });
  });
  return refs;
}

export const collectAssetIds = (data: DocumentData, registry: BlockRegistry) =>
  [...new Set(collectAssetReferences(data, registry).map((r) => r.assetId))];

// --------------------------------------------------------- translations ---

export type TranslatableString = {
  nodeId: string;
  type: string;
  path: string;
  kind: "text" | "richtext" | "alt";
  value: string;
  /** Hash of the source text; a translation whose hash differs is stale. */
  sourceHash: string;
};

export function hashText(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** The document root is addressed as node id "root"; its `title` feeds the page `<title>`. */
export const ROOT_NODE_ID = "root";

export function collectTranslatableStrings(data: DocumentData, registry: BlockRegistry): TranslatableString[] {
  const out: TranslatableString[] = [];
  const rootTitle = data.root?.props?.title;
  if (typeof rootTitle === "string" && rootTitle.trim()) {
    out.push({ nodeId: ROOT_NODE_ID, type: "root", path: "title", kind: "text", value: rootTitle, sourceHash: hashText(rootTitle) });
  }
  walkNodes(data, registry, ({ node }) => {
    const def = registry.get(node.type);
    if (!def) return;
    const nodeId = node.props.id as string;
    walkFields(def.fields, node.props, (field, value, path) => {
      if (isTranslatable(field) && typeof value === "string" && value.trim()) {
        out.push({ nodeId, type: node.type, path, kind: field.kind as "text" | "richtext", value, sourceHash: hashText(value) });
      } else if (field.kind === "media" && field.translatableAlt && value && (value as MediaValue).alt?.trim()) {
        const alt = (value as MediaValue).alt;
        out.push({ nodeId, type: node.type, path: `${path}.alt`, kind: "alt", value: alt, sourceHash: hashText(alt) });
      }
    });
  });
  return out;
}

export type TranslationEntry = { nodeId: string; path: string; value: string };

/** Overlays translated strings onto the source document (render-time only). */
export function applyTranslations(data: DocumentData, registry: BlockRegistry, entries: TranslationEntry[]): DocumentData {
  if (!entries.length) return data;
  const byNode = new Map<string, TranslationEntry[]>();
  for (const e of entries) byNode.set(e.nodeId, [...(byNode.get(e.nodeId) ?? []), e]);
  const rootTitle = byNode.get(ROOT_NODE_ID)?.find((e) => e.path === "title" && e.value)?.value;
  if (rootTitle && typeof data.root?.props?.title === "string") data = { ...data, root: { ...data.root, props: { ...data.root.props, title: rootTitle } } };
  return mapNodes(data, registry, (node) => {
    const list = byNode.get(node.props.id as string);
    if (!list) return node;
    let props = node.props;
    for (const e of list) if (e.value && getPath(props, e.path) !== undefined) props = setPath(props, e.path, e.value);
    return { ...node, props };
  });
}
