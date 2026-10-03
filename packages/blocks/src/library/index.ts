import { createRegistry } from "../core";
import { elementBlocks } from "./elements";
import { layoutBlocks } from "./layout";
import { composableSections } from "./sections/composable";
import { listSections } from "./sections/lists";
import { dataSections, formSections, siteSections } from "./sections/more";
import { siteChromeSections } from "./sections/site";
import { commerceSections } from "./sections/commerce";
import { accountSections } from "./sections/account";

export * from "./elements";
export * from "./layout";
export * from "./sections/composable";
export * from "./sections/lists";
export * from "./sections/more";
export * from "./sections/site";
export * from "./sections/commerce";
export * from "./sections/account";
export { useCart, CartCount, ClearCart, type CartLine } from "./cart";
export { header, headerFields, SectionHeader, type HeaderValue } from "./sections/header";
export { iconNames, iconSet, IconGlyph } from "./icons";
export { blockCss } from "./styles";

/** Every block in the universal library, in drawer order. */
export const library = [
  ...composableSections,
  ...listSections,
  ...formSections,
  ...siteChromeSections,
  ...siteSections,
  ...dataSections,
  ...commerceSections,
  ...accountSections,
  ...layoutBlocks,
  ...elementBlocks,
];

export const registry = createRegistry(library);
