import { baseCss, compileTheme, googleFontsUrl, type CompileOptions, type Theme } from "@qubo/stylekit";
import type { ReactNode } from "react";
import type { RenderMetadata } from "./core";
import { blockCss } from "./library/styles";

const cssCache = new WeakMap<Theme, string>();

/** Compiled theme CSS (cached per theme object). */
export function themeCss(theme: Theme, opts?: CompileOptions): string {
  if (opts) return compileTheme(theme, opts).css;
  let css = cssCache.get(theme);
  if (!css) {
    css = compileTheme(theme).css;
    cssCache.set(theme, css);
  }
  return css;
}

/**
 * Theme CSS plus its Google Fonts stylesheet. Apps that self-host the same
 * fonts (e.g. via next/font) pass `fonts={false}`.
 */
export function ThemeStyles({ theme, includeBase = true, fonts = true }: { theme: Theme; includeBase?: boolean; fonts?: boolean }) {
  const css = (includeBase ? baseCss + blockCss : "") + themeCss(theme);
  const href = fonts ? googleFontsUrl(theme) : null;
  return (
    <>
      {href ? <link rel="stylesheet" href={href} data-qubo-fonts={theme.id} /> : null}
      <style data-qubo-theme={theme.id} dangerouslySetInnerHTML={{ __html: css }} />
    </>
  );
}

/** The theme's site-wide effect. A scheduled one renders hidden; the site runtime switches it on in its window. */
function PageEffect({ theme }: { theme: Theme }) {
  const fx = theme.effects;
  const effect = fx.active ? fx.presets.find((e) => e.id === fx.active) : undefined;
  if (!effect) return null;
  return (
    <div
      className="qb-effect"
      data-effect={effect.id}
      data-effect-kind={effect.kind}
      data-effect-scope="page"
      data-effect-schedule={fx.schedule.enabled ? `${fx.schedule.from}..${fx.schedule.to}` : undefined}
      aria-hidden="true"
    />
  );
}

export type ThemeMode = "light" | "dark" | "system";

/** Scopes a subtree to a theme: `data-theme` + page scheme + mode. */
export function ThemeRoot({
  theme,
  scheme,
  mode = "system",
  children,
  styles = true,
  className,
}: {
  theme: Theme | undefined;
  scheme?: string;
  mode?: ThemeMode;
  children: ReactNode;
  styles?: boolean;
  className?: string;
}) {
  if (!theme) return <>{children}</>;
  const effectiveMode = theme.modeStrategy === "dual" ? mode : theme.modeStrategy;
  return (
    <div
      data-theme={theme.id}
      data-scheme={scheme || theme.defaultScheme}
      data-mode={effectiveMode}
      data-button-style={theme.defaultButton}
      className={className}
      style={{ minHeight: "100%" }}
    >
      {styles ? <ThemeStyles theme={theme} /> : null}
      {children}
      <PageEffect theme={theme} />
    </div>
  );
}

type RootProps = { children: ReactNode; puck?: { metadata?: RenderMetadata } };

export const themedRoot = {
  render: ({ children, puck }: RootProps) => (
    <ThemeRoot theme={puck?.metadata?.theme} mode={puck?.metadata?.mode}>
      {children}
    </ThemeRoot>
  ),
};

