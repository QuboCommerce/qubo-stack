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
    expect(html).toContain('<span class="qb-accent-text">froid professionnel</span>');
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
