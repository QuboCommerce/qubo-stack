"use client";

import { useState, type CSSProperties } from "react";

/** Before/after slider — the only interactive bit that needs client JS. */
export function CompareSlider({
  before,
  after,
  style,
}: {
  before: { src: string; alt: string };
  after: { src: string; alt: string };
  style?: CSSProperties;
}) {
  const [pos, setPos] = useState(50);
  return (
    <div className="pk-compare" style={{ ...style, "--pk-pos": `${pos}%` } as CSSProperties}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={after.src} alt={after.alt} />
      <div className="pk-compare-before">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={before.src} alt={before.alt} />
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Compare before and after"
        className="pk-compare-range"
      />
    </div>
  );
}
