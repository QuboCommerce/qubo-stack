import { defineTheme } from "../schema";

/** TailG Belgium — dark-first, racing red, wide display type. */
export const tailgTheme = defineTheme({
  id: "tailg",
  name: "TailG Night Ride",
  description: "Dark-first e-mobility: near-black steel, racing red, white type.",
  modeStrategy: "dual",
  palette: [
    { id: "racing-red", name: "Racing red", group: "brand", locked: true, value: "#DC2626", description: "The brand red. Primary buttons, price highlights." },
    { id: "racing-red-deep", name: "Deep red", group: "brand", value: "#B91C1C", description: "Primary buttons on light backgrounds (contrast)." },
    { id: "carbon", name: "Carbon", group: "neutral", value: "#151519", description: "Dark canvas; text on light." },
    { id: "carbon-deep", name: "Carbon deep", group: "neutral", value: "#0F0F13", description: "Footer and hero bands." },
    { id: "carbon-raised", name: "Carbon raised", group: "neutral", value: "#1C1C22", description: "Cards on dark." },
    { id: "graphite", name: "Graphite", group: "neutral", value: "#242429", description: "Secondary buttons on dark." },
    { id: "steel-line", name: "Steel line", group: "neutral", value: "#2F2F38", description: "Borders on dark." },
    { id: "night-navy", name: "Night navy", group: "accent", value: "#252540", description: "Accent panels on dark." },
    { id: "chalk", name: "Chalk", group: "neutral", value: "#F7F7F7", description: "Text on dark." },
    { id: "chalk-soft", name: "Chalk soft", group: "neutral", value: "#D3D8DC", description: "Muted text on dark." },
    { id: "white", name: "White", group: "neutral", value: "#FFFFFF", description: "Light-mode canvas." },
    { id: "fog", name: "Fog", group: "neutral", value: "#F0F0F3", description: "Light-mode secondary fills." },
    { id: "fog-line", name: "Fog line", group: "neutral", value: "#E5E5E5", description: "Borders on light." },
    { id: "iron", name: "Iron", group: "neutral", value: "#5A5A65", description: "Muted text on light." },
  ],
  schemes: [
    {
      id: "asphalt",
      name: "Asphalt",
      description: "Default dark canvas.",
      dark: { background: "carbon", text: "chalk", textMuted: "chalk-soft", primary: "racing-red-deep", onPrimary: "white", surface: "carbon-raised", onSurface: "chalk", secondary: "graphite", onSecondary: "chalk", accent: "night-navy", onAccent: "chalk", border: "steel-line", link: "chalk" },
      light: { background: "white", text: "carbon", textMuted: "iron", primary: "racing-red-deep", onPrimary: "white", surface: "fog", onSurface: "carbon", secondary: "fog", onSecondary: "carbon", accent: "fog", onAccent: "carbon", border: "fog-line", link: "racing-red-deep" },
    },
    {
      id: "pit-lane",
      name: "Pit lane",
      description: "Deepest black: hero, footer.",
      dark: { background: "carbon-deep", text: "chalk", textMuted: "chalk-soft", primary: "racing-red-deep", onPrimary: "white", surface: "carbon-raised", onSurface: "chalk", border: "steel-line", link: "chalk" },
      light: { background: "carbon", text: "chalk", textMuted: "chalk-soft", primary: "racing-red-deep", onPrimary: "white", surface: "carbon-raised", onSurface: "chalk", link: "chalk" },
    },
    {
      id: "red-flag",
      name: "Red flag",
      description: "Promo banners and launch CTAs.",
      dark: { background: "racing-red-deep", text: "white", primary: "white", onPrimary: "carbon", secondary: "carbon", onSecondary: "white", link: "white" },
      light: { background: "racing-red-deep", text: "white", primary: "white", onPrimary: "carbon", secondary: "carbon", onSecondary: "white", link: "white" },
    },
  ],
  defaultScheme: "asphalt",
  typeset: {
    fonts: [
      { id: "geist", family: "Geist", fallback: "system-ui, sans-serif", source: "google" },
      { id: "controller", family: "Controller Ext", fallback: "Impact, sans-serif", source: "asset", files: [] },
    ],
    roles: {
      display: { font: "controller", weight: 400, tracking: -0.01, lineHeight: 1 },
      heading: { font: "geist", weight: 700, tracking: -0.02, lineHeight: 1.1 },
      body: { font: "geist", weight: 400, lineHeight: 1.6 },
      accent: { font: "controller", weight: 400, lineHeight: 1.2, uppercase: true },
      mono: { font: "geist", weight: 500 },
    },
  },
  shape: { radius: 8, borderWidth: 1, shadows: [{ id: "glow", name: "Red glow", blur: 24, y: 0, color: { token: "racing-red", mix: { alpha: 0.35 } } }] },
  buttons: [
    { id: "sharp", name: "Sharp", radius: "md", uppercase: true, tracking: 0.04, weight: 700, hover: "glow" },
    { id: "slant", name: "Slant", radius: "none", fontRole: "accent", paddingX: 7, hover: "lift", shadow: "glow" },
  ],
  defaultButton: "sharp",
  motion: { profile: "lively", entrance: "rise", durationFast: 120 },
  flavor: { id: "fancy" },
});
