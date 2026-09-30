import { Render } from "@puckeditor/core/rsc";
import { toPuckConfig, type BlockRegistry, type DocumentData, type RenderMetadata } from "./core";
import { themedRoot } from "./theme";

export { ThemeRoot, ThemeStyles, themeCss, themedRoot, type ThemeMode } from "./theme";

/** Puck config for rendering only (RSC-safe; no editor field UIs). */
export function createRenderConfig(registry: BlockRegistry) {
  return toPuckConfig(registry, { mode: "render", root: themedRoot as never });
}

const configCache = new WeakMap<BlockRegistry, ReturnType<typeof createRenderConfig>>();

/** Renders a Peltier document. Works in Server Components and on the client. */
export function PeltierRender({
  registry,
  data,
  metadata = {},
}: {
  registry: BlockRegistry;
  data: DocumentData;
  metadata?: RenderMetadata;
}) {
  let config = configCache.get(registry);
  if (!config) {
    config = createRenderConfig(registry);
    configCache.set(registry, config);
  }
  return <Render config={config} data={data as never} metadata={metadata} />;
}
