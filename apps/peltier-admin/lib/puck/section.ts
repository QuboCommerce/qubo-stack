import type { Fields } from "@measured/puck";

/**
 * Shared section settings.
 *
 * On Shopify you end up asking for a background colour on this section, then
 * that section, then the next one. Here every block inherits the same section
 * controls by construction, so the merchant sees consistent tools wherever
 * they click.
 *
 * Add a control here once and every existing block gains it.
 */
export type SectionProps = {
  background: "none" | "surface" | "muted" | "brand" | "inverted";
  paddingY: "none" | "sm" | "md" | "lg" | "xl";
  maxWidth: "narrow" | "content" | "wide" | "full";
  anchorId?: string;
};

export const sectionDefaults: SectionProps = {
  background: "none",
  paddingY: "md",
  maxWidth: "content",
};

export const sectionFields: Fields<SectionProps> = {
  background: {
    type: "select",
    label: "Background",
    options: [
      { label: "None", value: "none" },
      { label: "Surface", value: "surface" },
      { label: "Muted", value: "muted" },
      { label: "Brand", value: "brand" },
      { label: "Inverted", value: "inverted" },
    ],
  },
  paddingY: {
    type: "select",
    label: "Vertical spacing",
    options: [
      { label: "None", value: "none" },
      { label: "Small", value: "sm" },
      { label: "Medium", value: "md" },
      { label: "Large", value: "lg" },
      { label: "Extra large", value: "xl" },
    ],
  },
  maxWidth: {
    type: "select",
    label: "Width",
    options: [
      { label: "Narrow", value: "narrow" },
      { label: "Content", value: "content" },
      { label: "Wide", value: "wide" },
      { label: "Full bleed", value: "full" },
    ],
  },
  anchorId: { type: "text", label: "Anchor id (optional)" },
};

const backgroundClass: Record<SectionProps["background"], string> = {
  none: "",
  surface: "bg-background",
  muted: "bg-muted",
  brand: "bg-primary text-primary-foreground",
  inverted: "bg-foreground text-background",
};

const paddingClass: Record<SectionProps["paddingY"], string> = {
  none: "py-0",
  sm: "py-6",
  md: "py-12",
  lg: "py-20",
  xl: "py-32",
};

const widthClass: Record<SectionProps["maxWidth"], string> = {
  narrow: "max-w-2xl",
  content: "max-w-5xl",
  wide: "max-w-7xl",
  full: "max-w-none",
};

export function sectionClasses(props: SectionProps) {
  return {
    outer: [backgroundClass[props.background], paddingClass[props.paddingY]]
      .filter(Boolean)
      .join(" "),
    inner: `mx-auto w-full px-4 ${widthClass[props.maxWidth]}`,
  };
}
