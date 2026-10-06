import { builtInThemes, hmFroidTheme } from "@qubo/stylekit";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  applyTranslations,
  blockCatalog,
  blockCategories,
  blueprintNode,
  collectAssetIds,
  collectTranslatableStrings,
  embedSrc,
  instantiate,
  library,
  decorRanges,
  hashText,
  migrateDocument,
  registry,
  toJsonSchema,
  toPuckConfig,
  validateDocument,
  walkNodes,
  type DocumentData,
  type SlotNode,
} from "../index";
import { QuboRender } from "../render";
import { ThemeRoot } from "../theme";
import { createEditorConfig } from "../editor";
import { hmFroidHomeFixture, sampleImages, sampleProducts, withSampleMedia } from "../fixtures";

const doc = (...content: SlotNode[]): DocumentData => ({ root: { props: { title: "Test" } }, content });

const everyBlockAndPreset = () =>
  library.flatMap((def) => [instantiate(registry, def.name), ...def.presets.map((p) => instantiate(registry, def.name, { preset: p.id }))]);

describe("registry", () => {
  it("has unique names, descriptions and known categories", () => {
    expect(library.length).toBeGreaterThanOrEqual(45);
    for (const def of library) {
      expect(def.name).toMatch(/^[A-Z][A-Za-z0-9]+$/);
      expect(def.description.length).toBeGreaterThan(10);
      expect(Object.keys(blockCategories)).toContain(def.category);
    }
  });

  it("filters by capability", () => {
    const names = registry.list({ capabilities: [] }).map((d) => d.name);
    expect(names).not.toContain("ProductGrid");
    expect(names).not.toContain("PostList");
    expect(registry.list({ capabilities: ["commerce"] }).map((d) => d.name)).toContain("ProductGrid");
  });

  it("sections get the chrome group with per-section overrides", () => {
    const hero = registry.get("Hero")!;
    const bar = registry.get("AnnouncementBar")!;
    expect((hero.defaults as Record<string, any>).section.spacingTop).toBe("2xl");
    expect((bar.defaults as Record<string, any>).section.spacingTop).toBe("2xs");
    expect((registry.get("Faq")!.defaults as Record<string, any>).section.spacingTop).toBe("xl");
    expect("section" in registry.get("Heading")!.defaults).toBe(false);
  });
});

describe("documents", () => {
  it("every block and preset instantiates into a valid document", () => {
    const data = doc(...everyBlockAndPreset());
    expect(validateDocument(data, registry)).toEqual([]);
  });

  it("instantiate assigns unique ids to nested slot children", () => {
    const hero = instantiate(registry, "Hero");
    const ids: string[] = [];
    walkNodes(doc(hero), registry, ({ node }) => ids.push(node.props.id as string));
    expect(ids.length).toBeGreaterThan(4);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("validate reports bad props and unknown blocks", () => {
    const issues = validateDocument(
      doc({ type: "Heading", props: { id: "h1", level: "h9" } }, { type: "Nope", props: { id: "x" } }),
      registry,
    );
    expect(issues.map((i) => i.type)).toEqual(expect.arrayContaining(["Heading", "Nope"]));
  });

  it("migrate fills defaults for sparse props", () => {
    const { data, changed } = migrateDocument(doc({ type: "Faq", props: { id: "f1" } }), registry);
    expect(changed).toBe(true);
    const props = data.content[0]!.props as Record<string, any>;
    expect(props._v).toBe(1);
    expect(props.items).toHaveLength(3);
    expect(props.section.width).toBe("content");
    expect(validateDocument(data, registry)).toEqual([]);
  });
});

describe("translations & assets", () => {
  const faq = instantiate(registry, "Faq", {
    props: { header: { title: "Questions" }, items: [{ question: "Hours?", answer: "9 to 5" }] },
  });
  const img = instantiate(registry, "Image", { props: { image: { assetId: "asset-1", alt: "Cold room" } } });
  const data = doc(faq, img);

  it("collects translatable strings including alt text", () => {
    const strings = collectTranslatableStrings(data, registry);
    const paths = strings.map((s) => s.path);
    expect(paths).toEqual(expect.arrayContaining(["header.title", "items.0.question", "items.0.answer", "image.alt"]));
    expect(strings.every((s) => s.sourceHash.length > 0)).toBe(true);
  });

  it("applies translations without touching the source", () => {
    const id = faq.props.id as string;
    const out = applyTranslations(data, registry, [
      { nodeId: id, path: "header.title", value: "Questions fréquentes" },
      { nodeId: id, path: "items.0.question", value: "Heures ?" },
    ]);
    const props = out.content[0]!.props as Record<string, any>;
    expect(props.header.title).toBe("Questions fréquentes");
    expect(props.items[0].question).toBe("Heures ?");
    expect((data.content[0]!.props as Record<string, any>).header.title).toBe("Questions");
  });

  it("collects asset ids", () => {
    expect(collectAssetIds(data, registry)).toEqual(["asset-1"]);
  });
});

describe("rendering", () => {
  it("renders every block and preset server-side with every built-in theme", () => {
    const data = doc(...everyBlockAndPreset());
    for (const theme of Object.values(builtInThemes)) {
      const html = renderToString(
        <QuboRender registry={registry} data={data} metadata={{ theme, site: { id: "s", type: "store", capabilities: ["commerce", "blog"] } }} />,
      );
      expect(html).toContain(`data-theme="${theme.id}"`);
      expect(html).toContain("qb-section");
    }
  });

  it("emits section chrome attributes and resolves links", () => {
    const hero = instantiate(registry, "Hero", {
      props: { section: { scheme: "polar-night", anchorId: "top", edges: { bottom: "wave" } } },
    });
    const html = renderToString(<QuboRender registry={registry} data={doc(hero)} metadata={{ theme: hmFroidTheme }} />);
    expect(html).toContain('id="top"');
    expect(html).toContain('data-scheme="polar-night"');
    expect(html).toContain('data-edge-side="bottom"');
    expect(html).toContain('href="/contact"');
    expect(html).toContain("--qb-color-"); // theme CSS inlined
    expect(html).toContain(".qb-grid"); // block CSS inlined
  });

  it("renders sparse props from Puck without crashing", () => {
    const sparse = doc({ type: "Heading", props: { id: "h", text: "Hi" } }, { type: "Section", props: { id: "s" } });
    expect(() => renderToString(<QuboRender registry={registry} data={sparse} metadata={{ theme: hmFroidTheme }} />)).not.toThrow();
  });

  it("renders blueprints with schema placeholders", () => {
    const bp = blueprintNode(registry, instantiate(registry, "Faq"));
    const html = renderToString(<QuboRender registry={registry} data={doc(bp)} metadata={{ theme: hmFroidTheme, blueprint: true }} />);
    expect(html).toContain("{{section.header.title}}");
    expect(html).toContain("{{section.items[0].question}}");
    const hero = blueprintNode(registry, instantiate(registry, "Hero"));
    const heroHtml = renderToString(<QuboRender registry={registry} data={doc(hero)} metadata={{ theme: hmFroidTheme }} />);
    expect(heroHtml).toContain("{{section.content[1].text}}");
  });
});

describe("fixtures", () => {
  it("HM Froid home validates and renders with bound product data", () => {
    const data = hmFroidHomeFixture();
    expect(validateDocument(data, registry)).toEqual([]);
    const grid = data.content.find((n) => n.type === "ProductGrid")!;
    const html = renderToString(
      <QuboRender
        registry={registry}
        data={data}
        metadata={{ theme: hmFroidTheme, locale: "fr", data: { [grid.props.id as string]: sampleProducts } }}
      />,
    );
    expect(html).toContain("Chambre froide positive");
    expect(html).toContain('href="/products/vitrine-150"');
    expect(html).toMatch(/<span class="qb-decor" data-decor="squiggle" data-decor-kind="squiggle" data-decor-animate="true">froid professionnel<svg class="qb-decor-mark"[^>]*><path d="M1 4[^"]*"><\/path><\/svg><\/span>/);
    expect(html).toContain('href="tel:+3220000000"');
  });

  it("list items from partial input are filled", () => {
    const grid = instantiate(registry, "FeatureGrid", { props: { items: [{ title: "Only title" }] } });
    const item = (grid.props as Record<string, any>).items[0];
    expect(item.link).toEqual({ kind: "url", value: "" });
    expect(item.icon).toBe("check");
  });
});

describe("sample media", () => {
  it("fills empty images through slots and leaves section chrome and set media alone", () => {
    const split = withSampleMedia(instantiate(registry, "SplitMedia"));
    const props = split.props as Record<string, any>;
    expect(sampleImages).toContain(props.media?.url);
    expect(props.section?.background?.media?.url).toBeFalsy();
    const set = instantiate(registry, "SplitMedia", { props: { media: { url: "https://x.test/a.jpg", alt: "a" } } });
    expect((withSampleMedia(set).props as Record<string, any>).media.url).toBe("https://x.test/a.jpg");
    for (const def of registry.list()) {
      const node = withSampleMedia(instantiate(registry, def.name));
      expect(validateDocument({ root: { props: {} }, content: [node] }, registry)).toEqual([]);
    }
  });
});

describe("puck & AI contracts", () => {
  it("editor config exposes fields, categories and theme-driven options", () => {
    const config = createEditorConfig(registry, { fieldContext: { theme: hmFroidTheme, audience: "merchant" } });
    expect(Object.keys(config.components)).toHaveLength(library.length);
    const hero = config.components.Hero as any;
    expect(hero.fields.content.type).toBe("slot");
    expect(hero.fields.section.type).toBe("object");
    // builder-only art is hidden for merchants
    expect(hero.fields.section.objectFields.art).toBeUndefined();
    const schemeOptions = hero.fields.section.objectFields.scheme.options.map((o: any) => o.value);
    expect(schemeOptions).toEqual(expect.arrayContaining(["", "ice", "polar-night"]));
    expect(config.categories?.sections?.components).toContain("Hero");
  });

  it("render config keeps only structural (slot) fields", () => {
    const config = toPuckConfig(registry, { mode: "render" });
    const hero = config.components.Hero as any;
    expect(Object.keys(hero.fields)).toEqual(["content"]);
  });

  it("JSON schema and catalog serialise", () => {
    const schema = toJsonSchema(registry, { capabilities: [] });
    const json = JSON.stringify(schema);
    expect(json).toContain('"const":"Hero"');
    expect(json).not.toContain('"const":"ProductGrid"');
    expect(blockCatalog(registry).find((b) => b.name === "Hero")?.presets.length).toBeGreaterThan(0);
  });

  it("embeds are allow-listed", () => {
    expect(embedSrc("https://www.youtube.com/watch?v=abc")).toBe("https://www.youtube-nocookie.com/embed/abc");
    expect(embedSrc("https://youtu.be/abc")).toBe("https://www.youtube-nocookie.com/embed/abc");
    expect(embedSrc("https://evil.example.com/x")).toBeNull();
    expect(embedSrc("http://www.youtube.com/watch?v=abc")).toBeNull();
    expect(embedSrc("javascript:alert(1)")).toBeNull();
  });
});

describe("site type presets", () => {
  it("every template starter validates for every site type", async () => {
    const { siteTypePresets, templateStarter } = await import("../presets");
    for (const preset of Object.values(siteTypePresets)) {
      for (const t of preset.templates) {
        const doc = templateStarter(t.kind, registry);
        expect(validateDocument(doc, registry), `${preset.type}/${t.kind}`).toEqual([]);
        expect(() => renderToString(<QuboRender registry={registry} data={doc} metadata={{ theme: hmFroidTheme }} />)).not.toThrow();
      }
      expect(preset.templates.filter((t) => t.isSystem).map((t) => t.kind)).toEqual(["not_found", "password", "maintenance"]);
    }
  });
});

describe("decor", () => {
  const heading = registry.get("Heading")!;
  const html = (props: Record<string, unknown>) =>
    renderToString(heading.component({ ...heading.defaults, ...props, puck: { metadata: { theme: hmFroidTheme } } }) as never);

  it("prefers ranges picked on this exact text and merges overlaps", () => {
    const text = "the cold or the cold";
    const ranges = [{ hash: hashText(text), at: [[16, 20], [4, 8], [6, 9]] as [number, number][] }];
    expect(decorRanges(text, { preset: "box", match: "the", ranges })).toEqual([[4, 9], [16, 20]]);
  });

  it("falls back to the phrase when the text changed since the ranges were picked", () => {
    const value = { preset: "box", match: "cold", ranges: [{ hash: hashText("old text"), at: [[0, 3]] as [number, number][] }] };
    expect(decorRanges("Stay COLD", value)).toEqual([[5, 9]]);
    expect(decorRanges("Stay warm", value)).toEqual([]);
  });

  it("tells the AI where preset ids come from", () => {
    const json = JSON.stringify(toJsonSchema(registry));
    expect(json).toContain("Id from the theme's surfaces.gradients");
    expect(json).toContain("Id from the theme's effects.presets");
  });

  it("renders nothing extra for unknown presets", () => {
    expect(html({ text: "Le froid", decor: { preset: "nope", match: "froid", ranges: [] } })).not.toContain("qb-decor");
  });

  it("upgrades v1 highlight to the accent decor, on load and at render", () => {
    const v1 = { id: "Heading-1", text: "Le froid professionnel", highlight: "froid", level: "h2", _v: 1 };
    const { data } = migrateDocument({ root: { props: {} }, content: [{ type: "Heading", props: v1 }] }, registry);
    const props = data.content[0]!.props as Record<string, unknown>;
    expect(props._v).toBe(2);
    expect(props.highlight).toBeUndefined();
    expect(props.decor).toEqual({ preset: "accent", match: "froid", ranges: [] });
    expect(renderToString(heading.component({ ...v1, puck: { metadata: { theme: hmFroidTheme } } }) as never)).toContain(
      'data-decor="accent" data-decor-kind="color">froid</span>',
    );
  });
});


describe("SiteHeader navigation patterns", () => {
  const header = registry.get("SiteHeader")!;
  const html = (props: Record<string, unknown>, theme = hmFroidTheme) =>
    renderToString(header.component({ ...header.defaults, id: "SiteHeader-t", ...props, puck: { metadata: { theme } } }) as never);
  const links = [{ label: "Shop", link: { kind: "url", value: "/shop" }, image: null, children: [{ label: "Ovens", link: { kind: "url", value: "/ovens" }, description: "Combi and pizza" }] }];

  it("renders the menu as a native popover with the theme's nav motion", () => {
    const theme = { ...hmFroidTheme, motion: { ...hmFroidTheme.motion, nav: { enter: "circle", exit: "fade", durationIn: 500, durationOut: 200 } } } as typeof hmFroidTheme;
    const out = html({ pattern: "fullscreen", links }, theme);
    expect(out).toContain('popover="auto"');
    expect(out).toMatch(/popovertarget="qb-menu-SiteHeader-t"/i);
    expect(out).toMatch(/data-menu="fullscreen"[^>]*data-enter="circle"[^>]*data-exit="fade"/);
    expect(out).toContain('data-collapse="always"');
    expect(out).not.toContain('class="qb-site-nav"');
  });

  it("keeps inline links for bar layouts and uses the small-screen menu kind", () => {
    const out = html({ pattern: "bar", menu: "sheet", side: "left", links });
    expect(out).toContain('class="qb-site-nav"');
    expect(out).toMatch(/data-menu="sheet" data-side="left"/);
    expect(html({ pattern: "bar", menu: "drop", links })).toMatch(/data-menu="drop" data-side="top"/);
  });

  it("renders mega panels with descriptions", () => {
    const out = html({ pattern: "bar-mega", links });
    expect(out).toContain("qb-site-mega");
    expect(out).toContain("Combi and pizza");
  });

  it("fills the layout defaults for headers saved before patterns existed", () => {
    const { pattern: _p, menu: _m, side: _s, ...old } = header.defaults as Record<string, unknown>;
    const out = renderToString(header.component({ ...old, id: "SiteHeader-o", links, puck: { metadata: {} } }) as never);
    expect(out).toContain('data-pattern="bar"');
    expect(out).toMatch(/data-menu="drop"/);
  });
});

describe("media modifiers", () => {
  const render = (name: string, props: Record<string, unknown>) => {
    const def = registry.get(name)!;
    return renderToString(def.component({ ...def.defaults, id: `${name}-t`, ...props, puck: { metadata: { theme: hmFroidTheme } } }) as never);
  };
  const image = { url: "https://example.com/a.jpg", alt: "Oven" };

  it("wraps images in a frame carrying shape, parallax and reveal", () => {
    const out = render("Image", { image, mask: "arch", parallax: "subtle", reveal: "rise", hover: "zoom", radius: "md" });
    expect(out).toMatch(/class="qb-figure" data-reveal="rise" data-hover="zoom"/);
    expect(out).toMatch(/class="qb-media-frame" data-mask="arch" data-parallax="subtle"/);
    expect(out).toContain("--qb-frame-radius:var(--qb-radius-md)");
    expect(out).toContain('class="qb-image"');
  });

  it("gives circle shapes a square ratio unless one is chosen", () => {
    expect(render("Image", { image, mask: "circle" })).toContain("aspect-ratio:1/1");
    expect(render("Image", { image, mask: "circle", aspect: "4/5" })).toContain("aspect-ratio:4/5");
    expect(render("Image", { image })).not.toContain("data-ratio");
  });

  it("only applies a custom shape when a mask image is chosen", () => {
    expect(render("Image", { image, mask: "custom" })).not.toContain("data-mask");
    const out = render("Image", { image, mask: "custom", maskImage: { url: "https://example.com/m.svg", alt: "" } });
    expect(out).toContain('data-mask="custom"');
    expect(out).toContain("--qb-mask-image:url(&quot;https://example.com/m.svg&quot;)");
  });

  it("renders overlay captions inside the frame", () => {
    const out = render("Image", { image, caption: "Fresh", captionPosition: "overlay" });
    expect(out).toMatch(/qb-media-frame[^]*qb-figure-overlay[^>]*>Fresh/);
    expect(render("Image", { image, caption: "Fresh" })).toContain('<figcaption class="qb-muted">Fresh');
  });

  it("marks ambient videos for the runtime and shares the frame", () => {
    const out = render("Video", { video: { url: "https://example.com/v.mp4", alt: "" }, mask: "squircle", reveal: "fade" });
    expect(out).toContain("data-ambient");
    expect(out).toMatch(/data-reveal="fade"[^]*data-mask="squircle"/);
    expect(render("Video", { video: { url: "https://example.com/v.mp4", alt: "" }, mode: "player" })).not.toContain("data-ambient");
  });

  it("keeps the linked card lift by default and offers other hovers", () => {
    expect(render("Card", { image, content: () => null, link: { kind: "url", value: "/x" } })).toMatch(/data-linked="true" data-hover="lift"/);
    const out = render("Card", { image, content: () => null, hover: "zoom" });
    expect(out).toContain('data-hover="zoom"');
    expect(out).toContain('class="qb-card-figure"');
  });
});

describe("page settings", () => {
  const [a, b] = hmFroidTheme.motion.transitions;
  const snow = hmFroidTheme.effects.presets[0]!;
  const theme = {
    ...hmFroidTheme,
    motion: { ...hmFroidTheme.motion, transition: "native" },
    effects: { ...hmFroidTheme.effects, active: snow.id, schedule: { enabled: true, from: "12-01", to: "01-06" } },
  };
  const html = (page: { transition?: string; effect?: string }) => renderToString(<ThemeRoot theme={theme} page={page}>x</ThemeRoot>);

  it("renders the theme effect with its schedule, a page pick without, or nothing", () => {
    expect(html({})).toContain('data-effect-schedule="12-01..01-06"');
    expect(html({ effect: "none" })).not.toContain("<div class=\"qb-effect\"");
    const own = html({ effect: hmFroidTheme.effects.presets[1]!.id });
    expect(own).toContain(`data-effect="${hmFroidTheme.effects.presets[1]!.id}"`);
    expect(own).not.toContain("data-effect-schedule=\"");
  });

  it("opts a page out of the theme's native crossfade when it picks its own", () => {
    expect(html({})).not.toContain("navigation: none");
    expect(html({ transition: b!.id ?? a!.id })).toContain("navigation: none");
    expect(html({ transition: "none" })).toContain("navigation: none");
  });

  it("exposes page fields on the root, except for header and footer groups", () => {
    const fields = (cfg: ReturnType<typeof createEditorConfig>) => Object.keys((cfg.root as { fields: object }).fields);
    expect(fields(createEditorConfig(registry))).toEqual(["title", "transition", "effect"]);
    expect(fields(createEditorConfig(registry, { page: false }))).toEqual(["title"]);
    expect(toJsonSchema(registry).properties.root.properties.props).toMatchObject({ properties: { transition: {}, effect: {} } });
  });
});
