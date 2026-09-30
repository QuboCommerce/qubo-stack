import { z } from "zod";
import type { BlockRegistry } from "./define";
import type { Capability } from "./context";

/**
 * JSON Schema for every block the site can use — the contract an AI generator
 * must satisfy. Output is validated with the same Zod schemas before insert.
 */
export function toJsonSchema(registry: BlockRegistry, opts: { capabilities?: readonly Capability[] } = {}) {
  const blocks = registry.list(opts.capabilities ? { capabilities: opts.capabilities } : {});
  const variants = blocks.map((def) => ({
    type: "object",
    title: def.label,
    description: def.description,
    properties: {
      type: { const: def.name },
      props: z.toJSONSchema(def.schema, { io: "input", unrepresentable: "any" }),
    },
    required: ["type", "props"],
    additionalProperties: false,
  }));
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "Peltier page content",
    type: "object",
    properties: { content: { type: "array", items: { oneOf: variants } } },
    required: ["content"],
  };
}

/** Compact catalogue for prompts: name, label, description, category, kind. */
export function blockCatalog(registry: BlockRegistry, opts: { capabilities?: readonly Capability[] } = {}) {
  return registry
    .list(opts.capabilities ? { capabilities: opts.capabilities } : {})
    .map(({ name, label, description, category, kind, presets }) => ({
      name,
      label,
      description,
      category,
      kind,
      presets: presets.map((p) => p.id),
    }));
}
