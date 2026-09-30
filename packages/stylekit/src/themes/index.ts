import { hmFroidTheme } from "./hm-froid";
import { lumeTheme } from "./lume";
import { smossieTheme } from "./smossie";
import { tailgTheme } from "./tailg";

export { hmFroidTheme, lumeTheme, smossieTheme, tailgTheme };

/** Built-in theme packs, keyed by id. */
export const builtInThemes = {
  [hmFroidTheme.id]: hmFroidTheme,
  [tailgTheme.id]: tailgTheme,
  [lumeTheme.id]: lumeTheme,
  [smossieTheme.id]: smossieTheme,
} as const;
