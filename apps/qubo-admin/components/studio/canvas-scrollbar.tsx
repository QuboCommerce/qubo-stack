"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@qubo/shared/utils";

const IDLE_MS = 2000;
const MIN_THUMB = 28;
const HIDE_NATIVE = "html{scrollbar-width:none}html::-webkit-scrollbar{display:none}";

type Metrics = { top: number; size: number; scrollable: boolean };

/**
 * Scrollbar for the canvas iframe, drawn outside the site in its own gutter so
 * it never covers content or changes the preview width. It slides out from
 * behind the canvas while scrolling and tucks away after two idle seconds.
 * `inset` puts it over the canvas edge instead (phones have no gutter).
 */
export function CanvasScrollbar({ doc, inset, onDrag }: { doc: Document | null; inset?: boolean; onDrag?: (dragging: boolean) => void }) {
  const track = useRef<HTMLDivElement>(null);
  const [m, setM] = useState<Metrics>({ top: 0, size: 0, scrollable: false });
  const [shown, setShown] = useState(false);
  const [held, setHeld] = useState(false);
  const [dragging, setDragging] = useState(false);
  const idle = useRef(0);
  const heldRef = useRef(false);
  heldRef.current = held || dragging;

  const scroller = useCallback(() => (doc ? (doc.scrollingElement ?? doc.documentElement) : null), [doc]);

  const measure = useCallback(() => {
    const se = scroller();
    const h = track.current?.clientHeight ?? 0;
    if (!se || !h) return;
    const max = se.scrollHeight - se.clientHeight;
    if (max <= 1) return setM({ top: 0, size: 0, scrollable: false });
    const size = Math.max(MIN_THUMB, (h * se.clientHeight) / se.scrollHeight);
    setM({ top: ((h - size) * se.scrollTop) / max, size, scrollable: true });
  }, [scroller]);

  const wake = useCallback(() => {
    setShown(true);
    window.clearTimeout(idle.current);
    idle.current = window.setTimeout(() => !heldRef.current && setShown(false), IDLE_MS);
  }, []);

  useEffect(() => {
    const se = scroller();
    if (!doc || !se) return;
    const style = doc.createElement("style");
    style.dataset.quboStudio = "scrollbar";
    style.textContent = HIDE_NATIVE;
    doc.head.append(style);

    let raf = 0;
    const frame = (fn: () => void) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fn);
    };
    const onScroll = () => frame(() => (measure(), wake()));
    const ro = new ResizeObserver(() => frame(measure));
    ro.observe(doc.documentElement);
    if (doc.body) ro.observe(doc.body);
    if (track.current) ro.observe(track.current);
    doc.addEventListener("scroll", onScroll, { passive: true });
    measure();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      doc.removeEventListener("scroll", onScroll);
      style.remove();
    };
  }, [doc, scroller, measure, wake]);

  useEffect(() => () => window.clearTimeout(idle.current), []);
  useEffect(() => onDrag?.(dragging), [dragging, onDrag]);

  const onThumbDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const se = scroller();
    const h = track.current?.clientHeight ?? 0;
    if (!se || !h || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startTop = se.scrollTop;
    const ratio = (se.scrollHeight - se.clientHeight) / Math.max(1, h - m.size);
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    setDragging(true);
    const move = (ev: PointerEvent) => {
      se.scrollTop = startTop + (ev.clientY - startY) * ratio;
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      setDragging(false);
      wake();
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };

  // A click on the empty track pages towards the pointer, like a native bar.
  const onTrackDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const se = scroller();
    const rect = track.current?.getBoundingClientRect();
    if (!se || !rect || e.button !== 0) return;
    const y = e.clientY - rect.top;
    const dir = y < m.top ? -1 : y > m.top + m.size ? 1 : 0;
    if (dir) se.scrollBy({ top: dir * se.clientHeight * 0.9, behavior: "smooth" });
  };

  if (!doc) return null;
  const visible = m.scrollable && (shown || held || dragging);

  return (
    <div
      aria-hidden
      className={cn(
        "group/sb absolute top-3 bottom-3 w-2.5 transition-[translate,opacity] duration-300 ease-out motion-reduce:transition-none",
        inset ? "right-0.5 z-20" : "left-full z-0 ml-px",
        visible ? "translate-x-0 opacity-100" : inset ? "pointer-events-none translate-x-full opacity-0" : "pointer-events-none -translate-x-full opacity-0",
      )}
      onPointerEnter={() => {
        setHeld(true);
        setShown(true);
      }}
      onPointerLeave={() => {
        setHeld(false);
        wake();
      }}
      onWheel={(e) => scroller()?.scrollBy({ top: e.deltaY, left: 0 })}
    >
      <div ref={track} className="relative h-full w-full" onPointerDown={onTrackDown}>
        <div
          onPointerDown={onThumbDown}
          className={cn(
            "absolute left-0.5 w-1 cursor-default touch-none rounded-full bg-foreground/25 transition-[width,background-color] duration-150",
            "group-hover/sb:w-2 group-hover/sb:bg-foreground/40",
            dragging && "w-2 bg-foreground/50",
          )}
          style={{ top: m.top, height: m.size }}
        />
      </div>
    </div>
  );
}
