import { createRegistry } from "../core";
import { elementBlocks } from "./elements";
import { layoutBlocks } from "./layout";
import { composableSections } from "./sections/composable";
import { listSections } from "./sections/lists";
import { dataSections, formSections, siteSections } from "./sections/more";

export * from "./elements";
export * from "./layout";
export * from "./sections/composable";
export * from "./sections/lists";
export * from "./sections/more";
export { header, headerFields, SectionHeader, type HeaderValue } from "./sections/header";
export { iconNames, iconSet, IconGlyph } from "./icons";
export { blockCss } from "./styles";

/** Every block in the universal library, in drawer order. */
export const library = [
  ...composableSections,
  ...listSections,
  ...formSections,
  ...siteSections,
  ...dataSections,
  ...layoutBlocks,
  ...elementBlocks,
];

export const registry = createRegistry(library);
