import { forwardRef } from "react";
import type { LucideProps } from "lucide-react";

/**
 * Thin line icons drawn on a 24px grid at 1.5 stroke: the HM Froid trade and
 * equipment set (worktables, sinks, cloches...) that lucide does not cover.
 * Names start with `line-`; they take the same props as lucide icons.
 */
const paths: Record<string, string> = {
  "line-pin": "<path d=\"M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z\"/><circle cx=\"12\" cy=\"10\" r=\"2.5\"/>",
  "line-catalogue": "<path d=\"M3 21V3h18v18M3 9h18M3 15h18M7 3v6M15 9v6M9 15v6\"/>",
  "line-cycle": "<path d=\"M20 7v5h-5M4 17v-5h5M6 8a7 7 0 0 1 12-1l2 5M4 12l2 5a7 7 0 0 0 12-1\"/>",
  "line-utensils": "<path d=\"M4 3v5a4 4 0 0 0 8 0V3M8 3v18M18 3v8h3V3M19.5 11v10\"/>",
  "line-factory": "<path d=\"M3 21V9l6 3V7l6 3V3h6v18H3ZM6 16h2M11 16h2M16 16h2\"/>",
  "line-basket": "<path d=\"m3 10 2 10h13l2-10H3ZM5 10V7h6M12 7h8V3M8 13v4M12 13v4M16 13v4\"/>",
  "line-cleaver": "<path d=\"M3 3h14v11H3V3ZM17 9h4v11a2 2 0 0 1-4 0V9Z\"/><circle cx=\"6.5\" cy=\"6.5\" r=\".8\"/>",
  "line-cloche": "<path d=\"M3 18h18M5 16a7 7 0 0 1 14 0H5ZM12 9V6M10 6h4M2 21h20\"/>",
  "line-rolling-pin": "<path d=\"m7 4 13 13-3 3L4 7l3-3ZM5.5 5.5 2 2M18.5 18.5 22 22\"/>",
  "line-truck": "<path d=\"M2 5h12v12H2V5ZM14 10h4l4 4v3h-8\"/><circle cx=\"6\" cy=\"18\" r=\"2\"/><circle cx=\"18\" cy=\"18\" r=\"2\"/>",
  "line-wrench": "<path d=\"M14 5a6 6 0 0 0 7 8L10 22l-4-4 9-11a6 6 0 0 0-1-2ZM14 5l4 4 4-4\"/>",
  "line-browse-grid": "<rect x=\"3\" y=\"3\" width=\"7\" height=\"7\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\"/><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\"/><rect x=\"14\" y=\"14\" width=\"7\" height=\"7\"/>",
  "line-box-check": "<path d=\"m3 7 9-4 9 4v10l-9 4-9-4V7ZM3 7l9 4 9-4M12 11v10M8 5l9 4v4\"/><path d=\"m16 16 1.5 1.5L21 14\"/>",
  "line-worktable": "<rect x=\"3\" y=\"6\" width=\"18\" height=\"4\"/><path d=\"M5 10v11M19 10v11M5 17h14\"/>",
  "line-sink": "<path d=\"M3 10h18l-2 7H5l-2-7ZM7 17v4M17 17v4M12 10V5a3 3 0 0 1 6 0v2M16 7h4\"/>",
  "line-shelf": "<path d=\"M4 3v18M20 3v18M4 7h16M4 13h16M4 19h16M8 3v4M15 9v4M9 15v4\"/>",
  "line-trolley": "<path d=\"M3 3h3v15h15M6 7h13v7H6\"/><circle cx=\"8\" cy=\"21\" r=\"1.5\"/><circle cx=\"19\" cy=\"21\" r=\"1.5\"/>",
  "line-chain-link": "<path d=\"m10 13 4-4M8 16l-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M16 8l2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0\" transform=\"translate(1 0) scale(.91)\"/>",
  "line-phone": "<path d=\"M5 3h4l2 5-3 2a15 15 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2C9 20 4 15 3 5a2 2 0 0 1 2-2Z\"/>",
  "line-headset": "<path d=\"M4 14v-3a8 8 0 0 1 16 0v3M20 17v2a2 2 0 0 1-2 2h-4\"/><rect x=\"2\" y=\"11\" width=\"5\" height=\"7\" rx=\"2\"/><rect x=\"17\" y=\"11\" width=\"5\" height=\"7\" rx=\"2\"/><path d=\"M11 21h3\"/>",
  "line-snow": "<path d=\"M12 2v20M4 7l16 10M20 7 4 17M8.5 3.9 12 6l3.5-2.1M8.5 20.1 12 18l3.5 2.1M3.8 10.5 7 12l-3.2 1.5M20.2 10.5 17 12l3.2 1.5\"/>",
  "line-flame": "<path d=\"M12 22a7 7 0 0 0 7-7c0-3.2-1.7-5.2-4-7.4.2 2.2-.9 3.4-2 4.1.1-3.4-1.5-6.5-4.7-9.2.3 3.9-3.3 7.3-3.3 12.2A7 7 0 0 0 12 22Z\"/><path d=\"M10 17.5c0-1.3.9-2.3 2-3.4.2 1.1 1.1 1.8 1.1 3.4a1.6 1.6 0 1 1-3.1 0Z\"/>",
  "line-steel-panel": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"1\"/><path d=\"M3 9h18M3 15h18M8 4v16M16 4v16\"/>",
  "line-whisk": "<path d=\"M5 3v5a3 3 0 0 0 6 0V3M8 3v18M16 3v8h4V3M18 11v10\"/>",
  "line-tools": "<path d=\"m14 6 4 4M9 21l-6-6 6-6 6 6-6 6ZM14 6l4-4 4 4-4 4M3 3l18 18\"/>",
};

export const lineIcons = Object.fromEntries(
  Object.entries(paths).map(([name, d]) => {
    const Icon = forwardRef<SVGSVGElement, LucideProps>(function LineIcon({ size = 24, strokeWidth = 1.5, color = "currentColor", ...props }, ref) {
      return (
        <svg
          ref={ref}
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          {...props}
          dangerouslySetInnerHTML={{ __html: d }}
        />
      );
    });
    Icon.displayName = name;
    return [name, Icon];
  }),
);
