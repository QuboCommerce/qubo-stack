import { hmFroidTheme } from "@qubo/stylekit";
import { createElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { instantiate, library, registry, type FieldMap } from "../index";

/**
 * In the editor, Puck replaces inline-editable text props with a React element
 * (its InlineTextField). This renders every block with that substitution, one
 * field at a time, and fails on any field whose block treats it as a string.
 */
const inlineElement = (value: string) => createElement("span", { "data-inline": "" }, value);

type Path = (string | number)[];

function inlinePaths(fields: FieldMap, props: Record<string, unknown>, base: Path = []): Path[] {
  const out: Path[] = [];
  for (const [name, def] of Object.entries(fields)) {
    const value = props[name];
    if (def.kind === "text" && def.inline) out.push([...base, name]);
    else if (def.kind === "group" && value && typeof value === "object") out.push(...inlinePaths(def.fields, value as Record<string, unknown>, [...base, name]));
    else if (def.kind === "list" && Array.isArray(value))
      value.forEach((item, i) => out.push(...inlinePaths(def.item, item as Record<string, unknown>, [...base, name, i])));
  }
  return out;
}

function withElementAt(props: Record<string, unknown>, path: Path): Record<string, unknown> {
  const copy = structuredClone(props);
  let cur = copy as Record<string | number, unknown>;
  for (const key of path.slice(0, -1)) cur = cur[key] as Record<string | number, unknown>;
  const last = path.at(-1)!;
  cur[last] = inlineElement(String(cur[last] ?? "") || "Sample");
  return copy;
}

const slotStub = () => null;

function stubSlots(fields: FieldMap, props: Record<string, unknown>) {
  const out = { ...props };
  for (const [name, def] of Object.entries(fields)) if (def.kind === "slot") out[name] = slotStub;
  return out;
}

describe("inline editing", () => {
  it("every inline text field renders as a child, never as a string", () => {
    const failures: string[] = [];
    for (const def of library) {
      const variants = [undefined, ...def.presets.map((p) => p.id)];
      for (const preset of variants) {
        const node = instantiate(registry, def.name, preset ? { preset } : {});
        const props = node.props as Record<string, unknown>;
        for (const path of inlinePaths(def.fields, props)) {
          const label = `${def.name}${preset ? `(${preset})` : ""}.${path.join(".")}`;
          const edited = stubSlots(def.fields, withElementAt(props, path));
          let html = "";
          try {
            html = renderToString(
              createElement(() => def.component({ ...edited, puck: { isEditing: true, metadata: { theme: hmFroidTheme } } }) as ReactNode),
            );
          } catch (e) {
            failures.push(`${label}: throws ${(e as Error).message}`);
            continue;
          }
          if (html.includes("[object Object]")) failures.push(`${label}: stringified`);
        }
      }
    }
    expect([...new Set(failures)]).toEqual([]);
  });

  it("highlighted headings keep the accent while editing", () => {
    const heading = registry.get("Heading")!;
    const text = createElement("span", { value: "Le froid professionnel" }, "Le froid professionnel");
    const html = renderToString(
      createElement(() => heading.component({ ...heading.defaults, text, highlight: "froid", puck: { isEditing: true } }) as ReactNode),
    );
    expect(html).toContain('<span class="qb-accent-text">froid</span>');
  });
});
