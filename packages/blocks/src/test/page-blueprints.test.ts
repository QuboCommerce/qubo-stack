import { describe, expect, test } from "bun:test";
import { registry } from "../library";
import { blueprintLocale, blueprintLocales, pageBlueprints, suggestPages } from "../presets";
import { validateDocument } from "../core";

const ctx = (locale: (typeof blueprintLocales)[number], capabilities: ("commerce" | "leads" | "catalog")[] = []) => ({
  locale,
  siteName: "HM Froid",
  capabilities,
});

describe("page blueprints", () => {
  test("every blueprint has a unique slug per language and no em-dash", () => {
    for (const locale of blueprintLocales) {
      const slugs = pageBlueprints.map((b) => b.slug[locale]);
      expect(new Set(slugs).size).toBe(slugs.length);
      for (const b of pageBlueprints) {
        expect(b.slug[locale]).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        expect(b.title[locale].length).toBeGreaterThan(2);
        expect(b.metaDescription[locale]).not.toContain("\u2014");
      }
    }
  });

  test("starters are valid documents in every language, with and without the shop", () => {
    for (const b of pageBlueprints) {
      for (const locale of blueprintLocales) {
        for (const caps of [[], ["commerce", "leads"]] as const) {
          const doc = b.starter(ctx(locale, [...caps]));
          expect(doc.content.length).toBeGreaterThan(0);
          const issues = validateDocument(doc, registry);
          expect(issues).toEqual([]);
          const json = JSON.stringify(doc);
          expect(json).not.toContain("\u2014");
        }
      }
    }
  });

  test("terms grow a sales section only for shops", () => {
    const terms = pageBlueprints.find((b) => b.id === "terms")!;
    const plain = JSON.stringify(terms.starter(ctx("fr-BE")));
    const shop = JSON.stringify(terms.starter(ctx("fr-BE", ["commerce"])));
    expect(plain).not.toContain("rétractation");
    expect(shop).toContain("rétractation");
  });

  test("contact carries a form only with the leads module", () => {
    const contact = pageBlueprints.find((b) => b.id === "contact")!;
    expect(contact.starter(ctx("nl-BE")).content.map((n) => n.type)).toEqual(["RichText", "Map"]);
    expect(contact.starter(ctx("nl-BE", ["leads"])).content.map((n) => n.type)).toEqual(["RichText", "ContactForm", "Map"]);
  });

  test("suggestions mark missing modules and existing pages", () => {
    const list = suggestPages({ locale: "fr", capabilities: ["leads"], existingSlugs: ["contact"] });
    const byId = Object.fromEntries(list.map((s) => [s.blueprint.id, s]));
    expect(byId.contact!.exists).toBe(true);
    expect(byId.contact!.slug).toBe("contact");
    expect(byId["delivery-payment"]!.missing).toEqual(["commerce"]);
    expect(byId.privacy!.missing).toEqual([]);
    expect(byId.sitemap!.slug).toBe("plan-du-site");
    expect(blueprintLocale("nl-BE")).toBe("nl-BE");
    expect(blueprintLocale("de")).toBe("en");
  });
});
