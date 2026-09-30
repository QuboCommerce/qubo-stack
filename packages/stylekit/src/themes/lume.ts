import { defineTheme } from "../schema";

/** Lumé Laser Clinic — warm terre-cuite, dual mode, calm motion. */
export const lumeTheme = defineTheme({
  id: "lume",
  name: "Lumé Terre Cuite",
  description: "Warm clay and cream. Light mode reads like paper; dark mode is the clay itself.",
  modeStrategy: "dual",
  palette: [
    { id: "terre-cuite", name: "Terre cuite", group: "brand", locked: true, value: "#BA6552", description: "The brand colour. Headings, primary buttons, dark-mode canvas." },
    { id: "terre-cuite-deep", name: "Deep terre cuite", group: "brand", value: "#9C5144", description: "Body text on light backgrounds; cards in dark mode." },
    { id: "taupe", name: "Warm taupe", group: "accent", value: "#C19276", description: "Quiet accent for dividers and secondary UI." },
    { id: "terra-light", name: "Light terra cotta", group: "accent", value: "#E0BB90", description: "Primary buttons in dark mode, highlight chips." },
    { id: "beige", name: "Warm beige", group: "neutral", value: "#E2D0B8", description: "Cards and alt sections in light mode." },
    { id: "cream", name: "Cream white", group: "neutral", value: "#FAF5E5", description: "Page background in light mode, text in dark mode." },
    { id: "ink", name: "Ink", group: "neutral", value: "#2B1A15", description: "Shadows only." },
  ],
  schemes: [
    {
      id: "canvas",
      name: "Cream canvas",
      description: "Default page background.",
      light: { background: "cream", text: "terre-cuite-deep", textMuted: "terre-cuite", link: "terre-cuite-deep", heading: "terre-cuite", primary: "terre-cuite", onPrimary: "cream", surface: "beige", onSurface: "terre-cuite-deep", accent: "taupe", onAccent: "cream", secondary: "beige", onSecondary: "terre-cuite-deep", border: { token: "taupe", mix: { alpha: 0.4 } } },
      dark: { background: "terre-cuite", text: "cream", textMuted: "cream", link: "cream", primary: "terra-light", onPrimary: "terre-cuite-deep", surface: "terre-cuite-deep", onSurface: "cream", accent: "terra-light", onAccent: "terre-cuite-deep", secondary: "cream", onSecondary: "terre-cuite-deep", border: { token: "cream", mix: { alpha: 0.2 } } },
    },
    {
      id: "clay",
      name: "Clay spotlight",
      description: "Full-bleed brand sections: hero bands, CTAs.",
      light: { background: "terre-cuite", text: "cream", textMuted: "cream", link: "cream", primary: "cream", onPrimary: "terre-cuite-deep", surface: "terre-cuite-deep", onSurface: "cream", secondary: "terra-light", onSecondary: "terre-cuite-deep" },
      dark: { background: "terre-cuite-deep", text: "cream", primary: "terra-light", onPrimary: "terre-cuite-deep", secondary: "cream", onSecondary: "terre-cuite-deep" },
    },
    {
      id: "sand",
      name: "Sand band",
      description: "Soft alternating sections: testimonials, FAQs.",
      light: { background: "beige", text: "terre-cuite-deep", textMuted: "terre-cuite-deep", heading: "terre-cuite-deep", primary: "terre-cuite-deep", onPrimary: "cream", secondary: "cream", onSecondary: "terre-cuite-deep", link: "terre-cuite-deep", surface: "cream", onSurface: "terre-cuite-deep" },
      dark: { background: "terre-cuite-deep", text: "cream", primary: "terra-light", onPrimary: "terre-cuite-deep", surface: "terre-cuite", onSurface: "cream" },
    },
  ],
  defaultScheme: "canvas",
  typeset: {
    fonts: [{ id: "helvetica", family: "Helvetica Neue", fallback: "Helvetica, Arial, sans-serif", source: "system" }],
    roles: {
      display: { font: "helvetica", weight: 300, tracking: -0.02, lineHeight: 1.05 },
      heading: { font: "helvetica", weight: 400, tracking: -0.01, lineHeight: 1.15 },
      body: { font: "helvetica", weight: 400, lineHeight: 1.6 },
      accent: { font: "helvetica", weight: 500, tracking: 0.12, lineHeight: 1.4, uppercase: true },
      mono: { font: "helvetica", weight: 400 },
    },
    scale: { baseMin: 16, baseMax: 18, ratioMin: 1.2, ratioMax: 1.3 },
  },
  shape: { radius: 4, borderWidth: 1, shadows: [{ id: "soft", name: "Soft", y: 8, blur: 24, color: { token: "ink", mix: { alpha: 0.08 } } }] },
  buttons: [
    { id: "pill", name: "Pill", radius: "full", paddingX: 6, paddingY: 3, weight: 500 },
    { id: "label", name: "Label", radius: "none", fontRole: "accent", weight: 500, uppercase: true, tracking: 0.12, hover: "lift" },
  ],
  defaultButton: "pill",
  motion: { profile: "subtle", entrance: "fade", durationBase: 400 },
  flavor: { id: "fancy" },
});
