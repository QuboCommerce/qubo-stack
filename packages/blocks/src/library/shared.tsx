import type { CSSProperties, ReactNode } from "react";
import type { Anchor } from "../core";

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

export const gap = (step: string) => `var(--qb-gap-${step})`;
export const typeSize = (step: string | number) => {
  const n = Number(step);
  return `var(--qb-step-${n < 0 ? `n${-n}` : n})`;
};

/** Maps a 9-point anchor to flex alignment for a given direction. */
export function anchorFlex(anchor: Anchor, direction: "column" | "row"): CSSProperties {
  const [v, h] = anchorParts(anchor);
  const main = direction === "column" ? v : h;
  const cross = direction === "column" ? h : v;
  const map = { start: "flex-start", center: "center", end: "flex-end" } as const;
  return { justifyContent: map[main], alignItems: map[cross] };
}

export function anchorParts(anchor: Anchor): ["start" | "center" | "end", "start" | "center" | "end"] {
  const v = anchor.startsWith("top") ? "start" : anchor.startsWith("bottom") ? "end" : "center";
  const h = anchor.endsWith("left") ? "start" : anchor.endsWith("right") ? "end" : "center";
  return [v, h];
}

export const textAlignOf = (anchor: Anchor): CSSProperties["textAlign"] => {
  const [, h] = anchorParts(anchor);
  return h === "start" ? "start" : h === "end" ? "end" : "center";
};

export const alignOptions = ["inherit", "start", "center", "end"] as const;
export type AlignOption = (typeof alignOptions)[number];
export const textAlign = (a: AlignOption): CSSProperties["textAlign"] => (a === "inherit" ? undefined : a);

export const aspectRatios = ["auto", "1/1", "4/3", "3/2", "16/9", "21/9", "3/4", "2/3", "9/16"] as const;
export const aspectOptions = aspectRatios.map((r) => ({ value: r, label: r === "auto" ? "Original" : r.replace("/", ":") }));

export const radiusOptions = ["none", "sm", "md", "lg", "xl", "full"] as const;

export function Empty({ label, ctx, minHeight = 96 }: { label: string; ctx: { isEditing: boolean }; minHeight?: number }) {
  if (!ctx.isEditing) return null;
  return (
    <div className="qb-empty" style={{ minHeight }}>
      {label}
    </div>
  );
}

export function Richtext({ value, className, style }: { value: ReactNode; className?: string; style?: CSSProperties }) {
  if (value === "" || value == null) return null;
  return (
    <div className={cx("qb-prose", className)} style={style}>
      {value}
    </div>
  );
}
