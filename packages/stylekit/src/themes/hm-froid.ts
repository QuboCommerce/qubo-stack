import { defineTheme } from "../schema";

/** HM Froid — "Arctic": cold blues, confident display type, dual mode. */
export const hmFroidTheme = defineTheme({
  id: "hm-froid",
  name: "HM Froid Arctic",
  description: "Industrial cooling: frost blues on ice white, deep polar navy for dark mode.",
  modeStrategy: "dual",
  palette: [
    { id: "polar", name: "Polar blue", group: "brand", locked: true, value: "oklch(0.4 0.145 255)", description: "The brand blue. Primary buttons and links on light." },
    { id: "frost", name: "Frost", group: "brand", value: "oklch(0.85 0.085 212)", description: "Primary on dark backgrounds; icy highlights." },
    { id: "glacier", name: "Glacier", group: "accent", value: "oklch(0.62 0.13 240)", description: "Gradients and illustration strokes." },
    { id: "ice-mist", name: "Ice mist", group: "accent", value: "oklch(0.86 0.075 210)", description: "Soft accent fills: badges, chips." },
    { id: "ice", name: "Ice white", group: "neutral", value: "oklch(0.985 0.006 220)", description: "Page background in light mode." },
    { id: "snow", name: "Snow", group: "neutral", value: "oklch(1 0 0)", description: "Cards on ice." },
    { id: "slate-line", name: "Slate line", group: "neutral", value: "oklch(0.9 0.015 225)", description: "Borders on light." },
    { id: "slate", name: "Slate", group: "neutral", value: "oklch(0.5 0.03 250)", description: "Muted text on light." },
    { id: "night", name: "Polar night", group: "neutral", value: "oklch(0.21 0.045 255)", description: "Body text on light; spotlight backgrounds." },
    { id: "abyss", name: "Abyss", group: "neutral", value: "oklch(0.145 0.028 258)", description: "Dark-mode background." },
    { id: "abyss-raised", name: "Abyss raised", group: "neutral", value: "oklch(0.185 0.032 256)", description: "Dark-mode cards." },
    { id: "frost-text", name: "Frost text", group: "neutral", value: "oklch(0.96 0.012 215)", description: "Text on dark." },
  ],
  schemes: [
    {
      id: "ice",
      name: "Ice canvas",
      description: "Default page background.",
      light: { background: "ice", text: "night", textMuted: "slate", primary: "polar", onPrimary: "snow", surface: "snow", onSurface: "night", accent: "ice-mist", onAccent: "night", secondary: "night", onSecondary: "snow", border: "slate-line", link: "polar" },
      dark: { background: "abyss", text: "frost-text", primary: "frost", onPrimary: "abyss", surface: "abyss-raised", onSurface: "frost-text", accent: "glacier", onAccent: "frost-text", secondary: "frost-text", onSecondary: "abyss", link: "frost" },
    },
    {
      id: "polar-night",
      name: "Polar night",
      description: "High-impact bands: hero, service CTA, footer.",
      light: { background: "night", text: "frost-text", primary: "frost", onPrimary: "night", surface: "abyss-raised", onSurface: "frost-text", secondary: "frost-text", onSecondary: "night", link: "frost" },
      dark: { background: "abyss-raised", text: "frost-text", primary: "frost", onPrimary: "abyss", link: "frost" },
    },
    {
      id: "frosted",
      name: "Frosted band",
      description: "Alternating content sections and trust strips.",
      light: { background: "ice-mist", text: "night", primary: "night", onPrimary: "snow", secondary: "snow", onSecondary: "night", surface: "snow", onSurface: "night", link: "night" },
      dark: { background: "abyss-raised", text: "frost-text", primary: "frost", onPrimary: "abyss", surface: "abyss", onSurface: "frost-text" },
    },
  ],
  defaultScheme: "ice",
  typeset: {
    fonts: [
      { id: "inter", family: "Inter", fallback: "system-ui, sans-serif", source: "google" },
      { id: "anton", family: "Anton", fallback: "Impact, sans-serif", source: "google" },
    ],
    roles: {
      display: { font: "anton", weight: 400, lineHeight: 1, uppercase: true },
      heading: { font: "inter", weight: 700, tracking: -0.02, lineHeight: 1.15 },
      body: { font: "inter", weight: 400, lineHeight: 1.6 },
      accent: { font: "inter", weight: 600, tracking: 0.08, lineHeight: 1.4, uppercase: true },
      mono: { font: "inter", weight: 500 },
    },
  },
  shape: { radius: 12, borderWidth: 1, shadows: [{ id: "frost", name: "Frost glow", y: 12, blur: 32, color: { token: "polar", mix: { alpha: 0.14 } } }] },
  buttons: [
    { id: "rounded", name: "Rounded", radius: "lg", paddingX: 6, paddingY: 3, hover: "lift", shadow: "frost" },
    { id: "industrial", name: "Industrial", radius: "sm", fontRole: "accent", uppercase: true, tracking: 0.08, hover: "darken" },
  ],
  defaultButton: "rounded",
  motion: { profile: "subtle", entrance: "rise" },
  flavor: { id: "grounded" },
});
