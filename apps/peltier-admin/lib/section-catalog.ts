import type { BlockDefinition, BlockRegistry, Capability } from "@peltier/blocks";

/**
 * How the Add-section modal groups sections: by what the merchant wants to
 * achieve, not by where the code lives. Unlisted sections land in "More".
 */
export const sectionGroups = [
  { id: "intro", label: "Intro & banners", blocks: ["Hero", "Slideshow", "AnnouncementBar", "Marquee"] },
  { id: "content", label: "Text & media", blocks: ["RichText", "SplitMedia", "FeatureGrid", "CardGrid", "Gallery", "Process"] },
  { id: "trust", label: "Trust & proof", blocks: ["Testimonials", "LogoCloud", "StatsBand", "Team", "Faq"] },
  { id: "convert", label: "Contact & conversion", blocks: ["CtaBand", "ContactForm", "Newsletter", "PricingTable", "Map"] },
  { id: "shop", label: "Shop", blocks: ["ProductGrid"] },
  { id: "blog", label: "Blog", blocks: ["PostList"] },
  { id: "more", label: "More", blocks: [] as string[] },
] as const;

export type SectionGroupId = (typeof sectionGroups)[number]["id"];

export type SectionEntry = {
  key: string;
  type: string;
  preset?: string;
  label: string;
  /** Preset name shown under the block label ("Full-bleed media"). */
  variant?: string;
  description: string;
  group: SectionGroupId;
  /** Capabilities the site lacks for this section. */
  missing: Capability[];
  search: string;
  /** Virtual viewport for the live thumbnail; thin bands render narrower so they read larger. */
  thumbWidth: number;
};

const thinBands = new Set(["AnnouncementBar", "Marquee"]);

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** True when a preset only restates the block's defaults (it'd look identical). */
function presetIsDefault(def: BlockDefinition, props: Record<string, unknown>) {
  const defaults = def.defaults as Record<string, unknown>;
  return Object.entries(props).every(([k, v]) => same(defaults[k], v));
}

/** One entry per section and per distinct preset, grouped and capability-checked. */
export function sectionCatalog(registry: BlockRegistry, capabilities: readonly string[]): SectionEntry[] {
  const caps = new Set(capabilities);
  const groupOf = (name: string): SectionGroupId =>
    sectionGroups.find((g) => (g.blocks as readonly string[]).includes(name))?.id ?? "more";

  const entries: SectionEntry[] = [];
  for (const def of registry.list()) {
    if (def.kind !== "section") continue;
    const missing = (def.requires ?? []).filter((c) => !caps.has(c));
    const base = {
      type: def.name,
      description: def.description,
      group: groupOf(def.name),
      missing,
      thumbWidth: thinBands.has(def.name) ? 640 : 1280,
    };
    const words = [def.name, def.label, def.description, ...(def.keywords ?? [])];
    const defaultPreset = def.presets.find((p) => presetIsDefault(def, p.props as Record<string, unknown>));

    entries.push({
      ...base,
      key: def.name,
      label: def.label,
      variant: defaultPreset?.label,
      search: [...words, defaultPreset?.label ?? ""].join(" ").toLowerCase(),
    });
    for (const p of def.presets) {
      if (p === defaultPreset) continue;
      entries.push({
        ...base,
        key: `${def.name}:${p.id}`,
        preset: p.id,
        label: def.label,
        variant: p.label,
        description: p.description ?? def.description,
        search: [...words, p.label, p.description ?? ""].join(" ").toLowerCase(),
      });
    }
  }

  const order = (e: SectionEntry) => {
    const g = sectionGroups.findIndex((x) => x.id === e.group);
    const i = (sectionGroups[g]!.blocks as readonly string[]).indexOf(e.type);
    return g * 1000 + (i < 0 ? 999 : i);
  };
  return entries.sort((a, b) => order(a) - order(b));
}
