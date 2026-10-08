"use client";

import type { Mode, Theme } from "@qubo/stylekit";
import { cn } from "@qubo/shared/utils";
import type { CSSProperties, ReactNode } from "react";

/**
 * Theme-scoped markup for previews inside the admin. The compiled theme CSS
 * (ThemeStyles, rendered once by the panel) is scoped to [data-theme], so
 * these swatches are the real thing, not an approximation.
 */
export function ThemeScope({
  theme,
  mode,
  scheme,
  button,
  className,
  style,
  children,
}: {
  theme: Theme;
  mode: Mode;
  scheme?: string;
  button?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div data-theme={theme.id} data-mode={mode} data-button-style={button ?? theme.defaultButton} style={{ fontSize: 14 }}>
      <div data-scheme={scheme ?? theme.defaultScheme} className={className} style={style}>
        {children}
      </div>
    </div>
  );
}

/** A small "what this scheme looks like" card: heading, text, buttons, a card. */
export function SchemePreview({ theme, scheme, mode, size = "sm", className }: { theme: Theme; scheme: string; mode: Mode; size?: "sm" | "lg"; className?: string }) {
  const lg = size === "lg";
  return (
    <ThemeScope theme={theme} mode={mode} scheme={scheme} className={cn("overflow-hidden rounded-lg", lg ? "p-4" : "p-3", className)}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="qb-font-accent" style={{ color: "var(--qb-accent-text)", fontSize: lg ? 10 : 9, marginBottom: 2 }}>Eyebrow</p>
          <p className="qb-font-heading" style={{ color: "var(--qb-heading)", fontSize: lg ? 20 : 15, lineHeight: 1.15 }}>Heading</p>
          <p className="qb-font-body" style={{ color: "var(--qb-text)", fontSize: lg ? 12 : 11, marginTop: 4, lineHeight: 1.4 }}>
            Body text <span style={{ color: "var(--qb-text-muted)" }}>and muted</span> <span style={{ color: "var(--qb-link)", textDecoration: "underline" }}>link</span>
          </p>
        </div>
        {lg && (
          <div
            className="w-24 shrink-0 rounded-md p-2"
            style={{ background: "var(--qb-surface)", color: "var(--qb-on-surface)", border: "1px solid var(--qb-border)", fontSize: 10, lineHeight: 1.3 }}
          >
            <span className="mb-1 block h-8 rounded-sm" style={{ background: "var(--qb-background-alt)" }} />
            Card text
          </div>
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="qb-button" data-emphasis="primary" data-size="sm" style={{ fontSize: lg ? 11 : 10, pointerEvents: "none" }}>Primary</span>
        <span className="qb-button" data-emphasis="secondary" data-size="sm" style={{ fontSize: lg ? 11 : 10, pointerEvents: "none" }}>Secondary</span>
        {lg && <span className="qb-badge" style={{ fontSize: 10 }}>Accent</span>}
      </div>
    </ThemeScope>
  );
}
