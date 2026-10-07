import { baseCss, compileTheme, googleFontsUrl, type CompileOptions, type Theme } from "@qubo/stylekit";
import type { ReactNode } from "react";
import type { RenderMetadata } from "./core";
import { pageBlocksNative, pageEffect, pageSettings, type PageSettings } from "./page-settings";
import { blockCss } from "./library/styles";
import { kitCss } from "./library/kits";

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
  const css = (includeBase ? baseCss + blockCss : "") + themeCss(theme) + kitCss(theme);
  const href = fonts ? googleFontsUrl(theme) : null;
  return (
    <>
      {href ? <link rel="stylesheet" href={href} data-qubo-fonts={theme.id} /> : null}
      <style data-qubo-theme={theme.id} dangerouslySetInnerHTML={{ __html: css }} />
    </>
  );
}

/**
 * The page's site-wide effect (the page's own pick, else the theme's). A
 * scheduled one renders hidden; the site runtime switches it on in its window.
 */
function PageEffect({ theme, page }: { theme: Theme; page?: PageSettings }) {
  const fx = pageEffect(theme, page);
  if (!fx) return null;
  return (
    <div
      className="qb-effect"
      data-effect={fx.effect.id}
      data-effect-kind={fx.effect.kind}
      data-effect-scope="page"
      data-effect-schedule={fx.schedule}
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
  page,
}: {
  theme: Theme | undefined;
  scheme?: string;
  mode?: ThemeMode;
  children: ReactNode;
  styles?: boolean;
  className?: string;
  /** Per-page transition and effect overrides (document root props). */
  page?: PageSettings;
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
      {/* Later @view-transition rules win: this page opts out of the theme's crossfade. */}
      {pageBlocksNative(theme, page) ? <style>{"@view-transition { navigation: none; }"}</style> : null}
      {children}
      <PageEffect theme={theme} page={page} />
    </div>
  );
}

type RootProps = { children: ReactNode; puck?: { metadata?: RenderMetadata } } & PageSettings;

export const themedRoot = {
  render: ({ children, puck, ...props }: RootProps) => (
    <ThemeRoot theme={puck?.metadata?.theme} mode={puck?.metadata?.mode} page={pageSettings(props)}>
      {children}
    </ThemeRoot>
  ),
};

