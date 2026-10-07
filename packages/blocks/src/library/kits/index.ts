import type { Theme } from "@qubo/stylekit";
import { chaptersCss } from "./chapters/styles";

/**
 * Section kits: art-directed block families with their own stylesheet, for a
 * site whose design does not fit the general blocks. A theme turns a kit on in
 * `theme.kits`; only then does its CSS ship with the page. Kit blocks are still
 * ordinary Puck blocks with fields, so the content stays editable.
 */
export type SectionKit = {
  id: string;
  label: string;
  /** Class and variable prefix after `qb-`: classes are `qb-<prefix>-*`. */
  prefix: string;
  css: string;
  /** Image variables the theme can fill: `--qb-<prefix>-<key>`. */
  assets: Record<string, { label: string; description: string }>;
};

export const sectionKits: Record<string, SectionKit> = {
  chapters: {
    id: "chapters",
    label: "Chapters",
    prefix: "ch",
    css: chaptersCss,
    assets: {
      "inox-grain": { label: "Inox texture", description: "Brushed steel photo behind metal buttons, cards and the hero frame." },
    },
  },
};

const cache = new WeakMap<Theme, string>();

/** CSS for the kits a theme turns on, plus its kit asset variables. */
export function kitCss(theme: Theme): string {
  const hit = cache.get(theme);
  if (hit !== undefined) return hit;
  const css = (theme.kits ?? [])
    .map((ref) => {
      const kit = sectionKits[ref.id];
      if (!kit) return "";
      const vars = Object.entries(ref.assets ?? {})
        .filter(([key, asset]) => kit.assets[key] && asset.url)
        .map(([key, asset]) => `--qb-${kit.prefix}-${key}: url(${JSON.stringify(asset.url)});`)
        .join(" ");
      return vars ? `${kit.css}\n[data-theme="${theme.id}"] { ${vars} }` : kit.css;
    })
    .join("\n");
  cache.set(theme, css);
  return css;
}

export const themeHasKit = (theme: Theme | undefined, kit: string) => Boolean(theme?.kits?.some((k) => k.id === kit));
