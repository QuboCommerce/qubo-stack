import type { Decor, DecorKind } from "@qubo/stylekit";
import type { ReactNode } from "react";
import type { RenderMetadata } from "./context";
import { textOf } from "./context";
import { hashText } from "./document";
import type { DecorValue } from "./fields";

/** Hand-drawn marks, stretched over the range (revealed left to right by a clip-path wipe). */
const marks: Partial<Record<DecorKind, { viewBox: string; d: string }>> = {
  squiggle: { viewBox: "0 0 100 8", d: "M1 4 Q 7.2 0.5 13.4 4 T 25.8 4 T 38.2 4 T 50.6 4 T 63 4 T 75.4 4 T 87.8 4 T 99 4" },
  stroke: {
    viewBox: "0 0 100 20",
    d: "M2 9 C 20 3 45 4 70 3 S 96 5 98 8 C 99 13 95 17 80 17 C 60 18 30 19 8 18 C 2 17 0 13 2 9 Z",
  },
  circle: { viewBox: "0 0 100 40", d: "M52 3 C 80 2 99 10 98 21 C 97 33 74 39 48 38 C 22 37 2 31 3 19 C 4 8 28 2 60 5" },
  box: { viewBox: "0 0 100 40", d: "M2 3 L 98 2 L 97.5 38 L 2.5 37.5 Z" },
};

/** Ranges for this exact text: the hash-keyed entry, else the phrase fallback. */
export function decorRanges(raw: string, value: DecorValue | undefined): [number, number][] {
  if (!value?.preset || !raw) return [];
  const hash = hashText(raw);
  const entry = value.ranges?.find((r) => r.hash === hash);
  let at: [number, number][] = entry?.at ?? [];
  if (!entry && value.match?.trim()) {
    const i = raw.toLowerCase().indexOf(value.match.trim().toLowerCase());
    if (i >= 0) at = [[i, i + value.match.trim().length]];
  }
  const sorted = at
    .map(([a, b]) => [Math.max(0, Math.min(a, raw.length)), Math.max(0, Math.min(b, raw.length))] as [number, number])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r[0] < last[1]) last[1] = Math.max(last[1], r[1]);
    else out.push(r);
  }
  return out;
}

export function DecorMark({ preset, children }: { preset: Decor; children: ReactNode }) {
  const mark = marks[preset.kind];
  return (
    <span className="qb-decor" data-decor={preset.id} data-decor-kind={preset.kind} data-decor-animate={preset.animate || undefined}>
      {children}
      {mark ? (
        <svg className="qb-decor-mark" viewBox={mark.viewBox} preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <path d={mark.d} />
        </svg>
      ) : null}
    </span>
  );
}

/**
 * Text with decor marks applied. In the editor `text` may be Puck's inline-edit
 * element; decorated text trades inline editing for an exact preview.
 */
export function Decorated({ text, decor, metadata }: { text: ReactNode; decor: DecorValue | undefined; metadata: RenderMetadata }): ReactNode {
  const preset = decor?.preset ? metadata.theme?.decor.find((d) => d.id === decor.preset) : undefined;
  if (!preset) return text;
  const raw = textOf(text);
  const ranges = decorRanges(raw, decor);
  if (!ranges.length) return text;
  const parts: ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([a, b], i) => {
    if (a > cursor) parts.push(raw.slice(cursor, a));
    parts.push(
      <DecorMark key={i} preset={preset}>
        {raw.slice(a, b)}
      </DecorMark>,
    );
    cursor = b;
  });
  if (cursor < raw.length) parts.push(raw.slice(cursor));
  return <>{parts}</>;
}
