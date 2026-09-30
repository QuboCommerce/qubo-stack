import "server-only";
import { activeModes, resolveRoleColor, toHex, type Theme } from "@peltier/stylekit";

export type SchemeSwatch = { id: string; name: string; description: string; background: string; text: string; primary: string; accent: string };

/** Serializable digest of a StyleKit theme for admin cards. */
export function summarizeTheme(raw: unknown) {
  const theme = raw as Theme;
  const mode = activeModes(theme)[0] ?? "light";
  const hex = (scheme: Theme["schemes"][number], role: Parameters<typeof resolveRoleColor>[3]) => {
    const c = resolveRoleColor(theme, scheme, mode, role);
    return c ? toHex(c) : "#888888";
  };
  const schemes: SchemeSwatch[] = theme.schemes.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description ?? "",
    background: hex(s, "background"),
    text: hex(s, "text"),
    primary: hex(s, "primary"),
    accent: hex(s, "accent"),
  }));
  return {
    name: theme.name,
    flavor: theme.flavor?.id ?? "grounded",
    modeStrategy: theme.modeStrategy,
    fonts: theme.typeset.fonts.map((f) => f.family),
    palette: theme.palette.slice(0, 12).map((t) => ({ id: t.id, name: t.name, value: t.value })),
    buttons: theme.buttons?.length ?? 0,
    schemes,
  };
}
export type ThemeSummary = ReturnType<typeof summarizeTheme>;
