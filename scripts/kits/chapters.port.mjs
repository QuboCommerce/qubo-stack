// Port config for the "chapters" kit: the HM Froid landing page designed in Manus (G01/I11).
export default {
  kit: "chapters",
  prefix: "ch",
  source: "the Manus HM Froid I11 export (styles.css)",
  out: "packages/blocks/src/library/kits/chapters/styles.ts",
  overrides: "packages/blocks/src/library/kits/chapters/overrides.css",
  exportName: "chaptersCss",
  // Demo-only UI from the design tool: the consent mock and the version explorer.
  drop: ["iteration-", "consent-", "has-consent-demo", "noscript-note", "js-only"],
  // Ids in the source become class selectors with the same or higher specificity.
  ids: {
    rayons: ".section--catalogue.section",
    "metiers-title": ".trade-section .section-heading h2",
    "material-title": ".material-interlude .material-interlude__copy h2",
  },
  // Attributes that would clash with Qubo's own blocks get a kit name.
  attributes: { "data-reveal": "data-ch-reveal", "data-reveal-delay": "data-ch-reveal-delay" },
  // Local files become kit variables; the theme's kit assets set the real URL.
  assets: {
    "/assets/images/hmfroid-inox-texture.webp": "none",
    "/assets/images/menu-vapor-poster.jpg": "var(--qb-ch-menu-poster, none)",
  },
};
