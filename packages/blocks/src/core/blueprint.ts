import type { BlockRegistry } from "./define";
import type { FieldMap, SlotNode } from "./fields";

/**
 * Blueprint = a block rendered with its schema instead of its content:
 * `{{section.heading}}` where the heading goes, a labelled box where the image
 * goes. Powers the component inspector with zero per-block work.
 */

export function placeholderImage(label: string, ratio = 16 / 9): string {
  const w = 1600;
  const h = Math.round(w / ratio);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#e9e9ee"/><rect x="12" y="12" width="${w - 24}" height="${h - 24}" fill="none" stroke="#9a9aa8" stroke-width="6" stroke-dasharray="28 18" rx="24"/><text x="50%" y="50%" fill="#6b6b78" font-family="ui-monospace,monospace" font-size="56" text-anchor="middle" dominant-baseline="middle">${label.replace(/[<&>]/g, "")}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const token = (path: string) => `{{${path}}}`;

function blueprintValues(fields: FieldMap, prefix: string, registry: BlockRegistry, skip: Set<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(fields)) {
    if (skip.has(key)) continue;
    const path = `${prefix}.${key}`;
    switch (def.kind) {
      case "text":
        out[key] = token(path);
        break;
      case "richtext":
        out[key] = `<p>${token(path)}</p>`;
        break;
      case "media":
        out[key] = { url: placeholderImage(path), alt: token(`${path}.alt`) };
        break;
      case "link":
        out[key] = { kind: "anchor", value: "blueprint" };
        break;
      case "list": {
        const count = Math.max(def.min ?? 0, Math.min(def.max ?? 3, 3));
        out[key] = Array.from({ length: count }, (_, i) =>
          blueprintValues(def.item, `${path}[${i}]`, registry, new Set()),
        );
        break;
      }
      case "group":
        out[key] = blueprintValues(def.fields, path, registry, new Set());
        break;
      case "slot":
        out[key] = [];
        break;
      default:
        out[key] = structuredClone(def.default);
    }
  }
  return out;
}

const contentKinds = new Set(["text", "richtext", "media", "list", "link"]);

/** Replaces content leaves with placeholders; keeps layout/style values as configured. */
function overlay(
  fields: FieldMap,
  target: Record<string, unknown>,
  placeholders: Record<string, unknown>,
  prefix: string,
  registry: BlockRegistry,
): Record<string, unknown> {
  const out = { ...target };
  for (const [key, def] of Object.entries(fields)) {
    if (!(key in placeholders)) continue;
    if (def.kind === "group") {
      out[key] = overlay(def.fields, (target[key] as Record<string, unknown>) ?? {}, placeholders[key] as Record<string, unknown>, `${prefix}.${key}`, registry);
    } else if (def.kind === "slot") {
      const children = Array.isArray(target[key]) && (target[key] as SlotNode[]).length ? (target[key] as SlotNode[]) : def.default;
      out[key] = children.map((child, i) => blueprintNode(registry, child, `${prefix}.${key}[${i}]`));
    } else if (contentKinds.has(def.kind)) {
      out[key] = placeholders[key];
    }
  }
  return out;
}

/** Blueprint for a node; keeps layout/style props, replaces content with placeholders. */
export function blueprintNode(registry: BlockRegistry, node: SlotNode, prefix?: string): SlotNode {
  const def = registry.get(node.type);
  if (!def) return node;
  const base = prefix ?? (def.kind === "section" ? "section" : "block");
  // Section chrome is presentation; show it as configured, not as placeholders.
  const placeholders = blueprintValues(def.fields, base, registry, new Set(["section"]));
  const props = overlay(def.fields, { ...structuredClone(def.defaults), ...node.props }, placeholders, base, registry);
  return { type: node.type, props: { ...props, id: `${node.props.id ?? node.type}-blueprint` } };
}
