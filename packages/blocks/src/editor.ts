import type { Config } from "@puckeditor/core";
import { pageFields, toPuckConfig, toPuckFields, type BlockRegistry, type Capability, type FieldAdapterContext, type FieldAdapters } from "./core";
import { themedRoot } from "./theme";

export type EditorConfigOptions = {
  capabilities?: readonly Capability[];
  fieldContext?: FieldAdapterContext;
  adapters?: FieldAdapters;
  /** Page settings (transition, effect) on the root; off for header and footer groups. */
  page?: boolean;
};

/**
 * Puck config for the Studio editor. Recreate it when the theme changes so
 * scheme/button-style pickers list the theme's options.
 */
export function createEditorConfig(registry: BlockRegistry, opts: EditorConfigOptions = {}): Config {
  const page = opts.page === false ? {} : toPuckFields(pageFields, "editor", opts.fieldContext, opts.adapters);
  return toPuckConfig(registry, {
    mode: "editor",
    ...opts,
    root: { ...themedRoot, fields: { title: { type: "text", label: "Page title" }, ...page } } as never,
  });
}

export { ThemeRoot, ThemeStyles, themeCss, themedRoot, type ThemeMode } from "./theme";
