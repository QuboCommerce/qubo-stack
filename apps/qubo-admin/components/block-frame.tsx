"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@qubo/shared/utils";

/**
 * Renders a canvas URL at a virtual viewport width and scales it to fit the
 * box — the "live thumbnail" technique (no screenshots, always current theme).
 */
export function BlockFrame({
  src,
  virtualWidth = 1280,
  height,
  className,
  title,
  interactive = false,
}: {
  src: string;
  virtualWidth?: number;
  /** Visible height in CSS px of the scaled box. */
  height: number;
  className?: string;
  title: string;
  interactive?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale(Math.min(1, entry!.contentRect.width / virtualWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [virtualWidth]);

  return (
    <div ref={box} className={cn("relative w-full overflow-hidden bg-muted/40", className)} style={{ height }}>
      {!loaded && <div className="absolute inset-0 animate-pulse bg-muted" />}
      {scale > 0 && (
        <iframe
          src={src}
          title={title}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          tabIndex={interactive ? 0 : -1}
          className={cn("absolute left-0 top-0 origin-top-left border-0 bg-white transition-opacity", loaded ? "opacity-100" : "opacity-0", !interactive && "pointer-events-none")}
          style={{ width: virtualWidth, height: height / scale, transform: `scale(${scale})` }}
        />
      )}
    </div>
  );
}
