/**
 * Curated Google Fonts for the theme editor's font picker. A starting set, not
 * the whole catalogue: good, well-hinted families that cover the site types we
 * build (clinics, studios, shops, trades). Custom families can still be typed in.
 */
export type CatalogFont = {
  family: string;
  category: "sans" | "serif" | "display" | "mono" | "handwriting";
  weights: number[];
  fallback: string;
};

const sans = "system-ui, sans-serif";
const serif = "Georgia, serif";
const mono = "ui-monospace, monospace";
const range = (a: number, b: number) => Array.from({ length: (b - a) / 100 + 1 }, (_, i) => a + i * 100);

export const fontCatalog: CatalogFont[] = [
  { family: "Inter", category: "sans", weights: range(100, 900), fallback: sans },
  { family: "Manrope", category: "sans", weights: range(200, 800), fallback: sans },
  { family: "DM Sans", category: "sans", weights: range(100, 1000).filter((w) => w <= 900), fallback: sans },
  { family: "Plus Jakarta Sans", category: "sans", weights: range(200, 800), fallback: sans },
  { family: "Outfit", category: "sans", weights: range(100, 900), fallback: sans },
  { family: "Figtree", category: "sans", weights: range(300, 900), fallback: sans },
  { family: "Work Sans", category: "sans", weights: range(100, 900), fallback: sans },
  { family: "Rubik", category: "sans", weights: range(300, 900), fallback: sans },
  { family: "Nunito Sans", category: "sans", weights: range(200, 900), fallback: sans },
  { family: "Poppins", category: "sans", weights: range(100, 900), fallback: sans },
  { family: "Montserrat", category: "sans", weights: range(100, 900), fallback: sans },
  { family: "Space Grotesk", category: "sans", weights: range(300, 700), fallback: sans },
  { family: "Sora", category: "sans", weights: range(100, 800), fallback: sans },
  { family: "Archivo", category: "sans", weights: range(100, 900), fallback: sans },
  { family: "Barlow", category: "sans", weights: range(100, 900), fallback: sans },
  { family: "IBM Plex Sans", category: "sans", weights: range(100, 700), fallback: sans },
  { family: "Lexend", category: "sans", weights: range(100, 900), fallback: sans },
  { family: "Fraunces", category: "serif", weights: range(100, 900), fallback: serif },
  { family: "Playfair Display", category: "serif", weights: range(400, 900), fallback: serif },
  { family: "Cormorant Garamond", category: "serif", weights: range(300, 700), fallback: serif },
  { family: "EB Garamond", category: "serif", weights: range(400, 800), fallback: serif },
  { family: "Lora", category: "serif", weights: range(400, 700), fallback: serif },
  { family: "DM Serif Display", category: "serif", weights: [400], fallback: serif },
  { family: "Libre Baskerville", category: "serif", weights: [400, 700], fallback: serif },
  { family: "Instrument Serif", category: "serif", weights: [400], fallback: serif },
  { family: "Newsreader", category: "serif", weights: range(200, 800), fallback: serif },
  { family: "Anton", category: "display", weights: [400], fallback: "Impact, sans-serif" },
  { family: "Bebas Neue", category: "display", weights: [400], fallback: "Impact, sans-serif" },
  { family: "Oswald", category: "display", weights: range(200, 700), fallback: "Impact, sans-serif" },
  { family: "Archivo Black", category: "display", weights: [400], fallback: sans },
  { family: "Syne", category: "display", weights: range(400, 800), fallback: sans },
  { family: "Unbounded", category: "display", weights: range(200, 900), fallback: sans },
  { family: "Big Shoulders Display", category: "display", weights: range(100, 900), fallback: sans },
  { family: "Caveat", category: "handwriting", weights: range(400, 700), fallback: "cursive" },
  { family: "JetBrains Mono", category: "mono", weights: range(100, 800), fallback: mono },
  { family: "IBM Plex Mono", category: "mono", weights: range(100, 700), fallback: mono },
  { family: "Space Mono", category: "mono", weights: [400, 700], fallback: mono },
];

export const catalogFont = (family: string) => fontCatalog.find((f) => f.family.toLowerCase() === family.toLowerCase());

/** Named modular-scale ratios (what designers call them). */
export const scaleRatios = [
  { value: 1.067, label: "Minor second" },
  { value: 1.125, label: "Major second" },
  { value: 1.2, label: "Minor third" },
  { value: 1.25, label: "Major third" },
  { value: 1.333, label: "Perfect fourth" },
  { value: 1.414, label: "Augmented fourth" },
  { value: 1.5, label: "Perfect fifth" },
  { value: 1.618, label: "Golden ratio" },
];

export const ratioLabel = (r: number) => scaleRatios.find((s) => Math.abs(s.value - r) < 0.005)?.label ?? `×${r}`;

export const weightNames: Record<number, string> = {
  100: "Thin",
  200: "Extra light",
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "Semibold",
  700: "Bold",
  800: "Extra bold",
  900: "Black",
};
