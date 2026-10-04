import type { CSSProperties } from "react";
import { defineBlock, f } from "../core";
import { anchorFlex, cx, gap } from "./shared";

const directionField = f.select(
  [
    { value: "column", label: "Stack ↓" },
    { value: "row", label: "Row →" },
  ],
  { label: "Direction", default: "column", group: "layout" },
);

const maxWidths = { prose: "70ch", narrow: "44rem", content: "72rem" } as const;

/** Figma auto-layout: direction, gap, 9-point alignment, wrap. */
export const Stack = defineBlock({
  name: "Stack",
  kind: "layout",
  label: "Stack",
  description: "Arranges blocks vertically or horizontally with a consistent gap and alignment.",
  category: "layout",
  icon: "rows-3",
  fields: {
    items: f.slot({ label: "Items" }),
    direction: f.responsive(directionField, { label: "Direction" }),
    gap: f.step("space", { label: "Gap", default: "sm" }),
    align: f.anchor({ label: "Alignment", default: "top-left" }),
    wrap: f.toggle({ label: "Wrap", group: "layout" }),
    maxWidth: f.select(["none", ...(Object.keys(maxWidths) as (keyof typeof maxWidths)[])], { label: "Max width", default: "none", group: "layout" }),
  },
  render: ({ items: Items, direction, gap: g, align, wrap, maxWidth }) => {
    const base = direction.base as "column" | "row";
    const style = {
      "--qb-dir": base,
      "--qb-dir-md": direction.md ?? base,
      "--qb-dir-lg": direction.lg ?? direction.md ?? base,
      gap: gap(g),
      flexWrap: wrap ? "wrap" : undefined,
      ...anchorFlex(align, base),
      ...(maxWidth !== "none" ? { maxWidth: maxWidths[maxWidth], marginInline: "auto", width: "100%" } : {}),
    } as CSSProperties;
    return <Items className={cx("qb-stack")} style={style} />;
  },
});

export const Grid = defineBlock({
  name: "Grid",
  kind: "layout",
  label: "Grid",
  description: "Responsive grid; column count per breakpoint.",
  category: "layout",
  icon: "layout-grid",
  fields: {
    items: f.slot({ label: "Items" }),
    columns: f.responsive(f.number({ label: "Columns", min: 1, max: 6, default: 1 }), {
      label: "Columns",
      default: { base: 1, md: 2, lg: 3 },
    }),
    gap: f.step("space", { label: "Gap", default: "md" }),
    alignItems: f.select(["stretch", "start", "center", "end"], { label: "Vertical alignment", default: "stretch", group: "layout" }),
  },
  render: ({ items: Items, columns, gap: g, alignItems }) => {
    const style = {
      "--qb-cols": columns.base,
      "--qb-cols-md": columns.md ?? columns.base,
      "--qb-cols-lg": columns.lg ?? columns.md ?? columns.base,
      gap: gap(g),
      alignItems,
    } as CSSProperties;
    return <Items className="qb-grid" style={style} />;
  },
});

const ratios = {
  "1:1": [1, 1],
  "2:1": [2, 1],
  "1:2": [1, 2],
  "3:2": [3, 2],
  "2:3": [2, 3],
} as const;

export const Columns = defineBlock({
  name: "Columns",
  kind: "layout",
  label: "Columns",
  description: "Two columns with a ratio; stacks on mobile.",
  category: "layout",
  icon: "columns-2",
  fields: {
    left: f.slot({ label: "Left" }),
    right: f.slot({ label: "Right" }),
    ratio: f.select(Object.keys(ratios) as (keyof typeof ratios)[], { label: "Ratio", default: "1:1", group: "layout" }),
    gap: f.step("space", { label: "Gap", default: "lg" }),
    alignItems: f.select(["start", "center", "end", "stretch"], { label: "Vertical alignment", default: "center", group: "layout" }),
    reverseOnMobile: f.toggle({ label: "Right column first on mobile", group: "layout" }),
  },
  render: ({ left: Left, right: Right, ratio, gap: g, alignItems, reverseOnMobile }) => {
    const [a, b] = ratios[ratio];
    return (
      <div
        className="qb-columns"
        data-reverse-mobile={reverseOnMobile || undefined}
        style={{ "--qb-col-a": `${a}fr`, "--qb-col-b": `${b}fr`, gap: gap(g), alignItems } as CSSProperties}
      >
        <Left className="qb-column" />
        <Right className="qb-column" />
      </div>
    );
  },
});

export const Container = defineBlock({
  name: "Container",
  kind: "layout",
  label: "Container",
  description: "Box with its own color scheme, padding, corners and border — a panel inside a section.",
  category: "layout",
  icon: "square-dashed",
  fields: {
    content: f.slot({ label: "Content" }),
    scheme: f.scheme({ label: "Color scheme" }),
    padding: f.responsive(f.step("space", { label: "Padding", default: "lg" }), { label: "Padding" }),
    radius: f.select(["none", "sm", "md", "lg", "xl"], { label: "Corners", default: "lg", group: "style" }),
    border: f.toggle({ label: "Border", group: "style" }),
    shadow: f.select(["none", "sm", "md", "lg"], { label: "Shadow", default: "none", group: "style" }),
    gap: f.step("space", { label: "Gap", default: "sm" }),
    maxWidth: f.select(["none", ...(Object.keys(maxWidths) as (keyof typeof maxWidths)[])], {
      label: "Max width",
      default: "none",
      group: "layout",
    }),
  },
  render: ({ content: Content, scheme, padding, radius, border, shadow, gap: g, maxWidth }) => (
    <div
      className="qb-box"
      data-scheme={scheme || undefined}
      data-border={border || undefined}
      style={
        {
          "--qb-box-p": gap(padding.base),
          "--qb-box-p-md": gap(padding.md ?? padding.base),
          "--qb-box-p-lg": gap(padding.lg ?? padding.md ?? padding.base),
          borderRadius: `var(--qb-radius-${radius})`,
          boxShadow: shadow === "none" ? undefined : `var(--qb-shadow-${shadow}, none)`,
          ...(maxWidth !== "none" ? { maxWidth: maxWidths[maxWidth], marginInline: "auto" } : {}),
        } as CSSProperties
      }
    >
      <Content className="qb-stack" style={{ gap: gap(g) } as CSSProperties} />
    </div>
  ),
});

export const Spacer = defineBlock({
  name: "Spacer",
  kind: "layout",
  label: "Spacer",
  description: "Empty vertical space on the theme's spacing scale.",
  category: "layout",
  icon: "move-vertical",
  fields: {
    size: f.responsive(f.step("space", { label: "Size", default: "lg" }), { label: "Size" }),
  },
  render: ({ size }) => (
    <div
      aria-hidden="true"
      className="qb-spacer"
      style={
        {
          "--qb-spacer": gap(size.base),
          "--qb-spacer-md": gap(size.md ?? size.base),
          "--qb-spacer-lg": gap(size.lg ?? size.md ?? size.base),
        } as CSSProperties
      }
    />
  ),
});

export const Divider = defineBlock({
  name: "Divider",
  kind: "layout",
  label: "Divider",
  description: "A horizontal rule: line, dashed, dotted or a short accent bar.",
  category: "layout",
  icon: "minus",
  fields: {
    style: f.select(["line", "dashed", "dotted", "accent", "wave"], { label: "Style", default: "line", group: "style" }),
    spacing: f.step("space", { label: "Spacing", default: "md" }),
  },
  render: ({ style, spacing }) => (
    <hr className="qb-divider" data-style={style} style={{ marginBlock: gap(spacing) }} />
  ),
});

export const layoutBlocks = [Stack, Grid, Columns, Container, Spacer, Divider];
