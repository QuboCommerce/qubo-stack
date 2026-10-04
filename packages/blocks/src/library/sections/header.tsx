import type { CSSProperties } from "react";
import { f, resolveLink, linkTarget, type BlockContext, type LinkValue } from "../../core";
import { cx, gap } from "../shared";

/**
 * The header every list-based section shares (eyebrow, title, intro, CTA).
 * Declared once so FAQ, Testimonials, Pricing… stay consistent and gain new
 * header options together.
 */
export const headerFields = {
  eyebrow: f.text({ label: "Eyebrow", maxLength: 80 }),
  title: f.text({ label: "Title", default: "Section title", multiline: true }),
  intro: f.text({ label: "Intro", multiline: true }),
  cta: f.group(
    {
      label: f.text({ label: "Button label" }),
      link: f.link({ label: "Button link" }),
    },
    { label: "Header button" },
  ),
  align: f.select(["start", "center"], { label: "Header alignment", default: "center", group: "layout" }),
  titleSize: f.select(["2", "3", "4", "5"], { label: "Title size", default: "4", group: "style" }),
};

export const header = (defaults: { title?: string; intro?: string; eyebrow?: string; align?: "start" | "center" } = {}) =>
  f.group(headerFields, { label: "Header", collapsed: false, default: defaults });

export type HeaderValue = {
  eyebrow: string;
  title: string;
  intro: string;
  cta: { label: string; link: LinkValue };
  align: "start" | "center";
  titleSize: string;
};

export function SectionHeader({
  value,
  ctx,
  level = "h2",
  className,
  style,
}: {
  value: HeaderValue;
  ctx: BlockContext;
  level?: "h1" | "h2";
  className?: string;
  style?: CSSProperties;
}) {
  if (!value.eyebrow && !value.title && !value.intro && !value.cta.label) return null;
  const Tag = level;
  const href = resolveLink(value.cta.link, ctx.metadata);
  return (
    <header className={cx("qb-section-header", className)} data-align={value.align} style={style}>
      {value.eyebrow ? <p className="qb-eyebrow qb-font-accent">{value.eyebrow}</p> : null}
      {value.title ? (
        <Tag className="qb-heading qb-font-heading" style={{ fontSize: `var(--qb-step-${value.titleSize})` }}>
          {value.title}
        </Tag>
      ) : null}
      {value.intro ? <p className="qb-muted qb-intro">{value.intro}</p> : null}
      {value.cta.label && href ? (
        <a className="qb-button" data-emphasis="outline" href={ctx.isEditing ? undefined : href} {...linkTarget(value.cta.link)}>
          {value.cta.label}
        </a>
      ) : null}
    </header>
  );
}

export const columnsField = (base = 1, md = 2, lg = 3) =>
  f.responsive(f.number({ label: "Columns", min: 1, max: 6 }), {
    label: "Columns",
    group: "layout",
    default: { base, md, lg },
  });

export const colsStyle = (cols: { base: number; md?: number; lg?: number }, g = "md"): CSSProperties =>
  ({
    "--qb-cols": cols.base,
    "--qb-cols-md": cols.md ?? cols.base,
    "--qb-cols-lg": cols.lg ?? cols.md ?? cols.base,
    gap: gap(g),
  }) as CSSProperties;
