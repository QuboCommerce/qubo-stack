import { z } from "zod";
import { f } from "./fields";

/**
 * Page-level settings on the document root (`root.props`), shown in the studio
 * when nothing on the canvas is selected. Resolved by `page-settings.ts`.
 */
export const pageFields = {
  transition: f.preset("transition", {
    label: "Page transition",
    empty: "theme",
    description: "Plays when a visitor follows a link from this page.",
  }),
  effect: f.preset("effect", {
    label: "Page effect",
    empty: "theme",
    description: "Ambient effect over the whole page. A page pick ignores the theme's date window.",
  }),
};

export const pageRootSchema = z.object({
  title: z.string().optional().describe("Page title (browser tab and search results)."),
  transition: pageFields.transition.schema.optional(),
  effect: pageFields.effect.schema.optional(),
});
