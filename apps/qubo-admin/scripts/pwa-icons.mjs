// Renders the PNG app icons from public/icon.svg and public/icon-maskable.svg.
// Run after changing the mark: node scripts/pwa-icons.mjs
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const pub = fileURLToPath(new URL("../public/", import.meta.url));
const icon = await readFile(`${pub}icon.svg`);
const bleed = await readFile(`${pub}icon-maskable.svg`);

const out = [
  [icon, 192, "icon-192.png"],
  [icon, 512, "icon-512.png"],
  [bleed, 512, "icon-maskable-512.png"],
  // iOS paints transparent pixels black and applies its own mask: full bleed only.
  [bleed, 180, "apple-touch-icon.png"],
];
for (const [svg, size, name] of out) {
  await sharp(svg, { density: Math.ceil((72 * size) / 32) }).resize(size, size).png({ compressionLevel: 9 }).toFile(`${pub}${name}`);
  console.log(name);
}
