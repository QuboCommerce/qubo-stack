import type { Config } from "@puckeditor/core";
import { toPuckConfig, type BlockRegistry, type Capability, type FieldAdapterContext, type FieldAdapters } from "./core";
import { themedRoot } from "./theme";

export type EditorConfigOptions = {
  capabilities?: readonly Capability[];
  fieldContext?: FieldAdapterContext;
  adapters?: FieldAdapters;
};

/**
 * Puck config for the Studio editor. Recreate it when the theme changes so
 * scheme/button-style pickers list the theme's options.
 */
export function createEditorConfig(registry: BlockRegistry, opts: EditorConfigOptions = {}): Config {
  return toPuckConfig(registry, {
    mode: "editor",
    ...opts,
    root: { ...themedRoot, fields: { title: { type: "text", label: "Page title" } } } as never,
  });
}

export { ThemeRoot, ThemeStyles, themeCss, themedRoot, type ThemeMode } from "./theme";
