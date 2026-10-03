/**
 * Seeds Studio records for every existing site from its site-type preset:
 * capabilities, locales, templates (+ documents), header/footer groups,
 * a theme and a contact form. Idempotent: existing rows are left alone.
 *
 *   pnpm --filter qubo-admin seed:studio
 */
import { db } from "@qubo/db/client";
import { document, documentRevision, form, sectionGroup, site, siteLocale, template, theme } from "@qubo/db/schema";
import { registry } from "@qubo/blocks";
import { hmFroidHomeFixture } from "@qubo/blocks/fixtures";
import { siteTypePresets, templateStarter } from "@qubo/blocks/presets";
import { builtInThemes, diagnoseTheme, hmFroidTheme } from "@qubo/stylekit";
import { and, eq } from "drizzle-orm";

const locales = ["fr-BE", "nl-BE", "en"];
const themeFor = (slug: string) => (slug.includes("tailg") ? builtInThemes.tailg : hmFroidTheme);

async function createDocument(siteId: string, kind: "template" | "section_group", data: unknown, publish: boolean) {
  const [doc] = await db
    .insert(document)
    .values({ siteId, kind, draftData: data, publishedData: publish ? data : null, publishedAt: publish ? new Date() : null })
    .returning({ id: document.id });
  if (publish) {
    const [rev] = await db
      .insert(documentRevision)
      .values({ documentId: doc!.id, version: 1, kind: "publish", data, label: "Initial" })
      .returning({ id: documentRevision.id });
    await db.update(document).set({ publishedRevisionId: rev!.id }).where(eq(document.id, doc!.id));
  }
  return doc!.id;
}

async function main() {
  const sites = await db.select().from(site);
  for (const s of sites) {
    const preset = siteTypePresets[s.type];
    const log = (msg: string) => console.log(`[${s.slug}] ${msg}`);

    if (!s.capabilities.length) {
      await db.update(site).set({ capabilities: preset.capabilities }).where(eq(site.id, s.id));
      log(`capabilities ← ${preset.capabilities.join(", ")}`);
    }

    for (const locale of locales) {
      const inserted = await db
        .insert(siteLocale)
        .values({ siteId: s.id, locale, isPrimary: locale === s.locale, isPublished: locale === s.locale })
        .onConflictDoNothing()
        .returning({ id: siteLocale.id });
      if (inserted.length) log(`locale ${locale}${locale === s.locale ? " (primary)" : ""}`);
    }

    for (const t of preset.templates) {
      const [exists] = await db
        .select({ id: template.id })
        .from(template)
        .where(and(eq(template.siteId, s.id), eq(template.resourceKind, t.kind), eq(template.handle, "default")));
      if (exists) continue;
      const data = t.kind === "home" && s.slug.includes("hm") ? hmFroidHomeFixture(registry) : templateStarter(t.kind, registry);
      const documentId = await createDocument(s.id, "template", data, true);
      await db.insert(template).values({ siteId: s.id, resourceKind: t.kind, name: t.name, isSystem: !!t.isSystem, documentId });
      log(`template ${t.kind}`);
    }

    for (const kind of ["header", "footer"] as const) {
      const [exists] = await db.select({ id: sectionGroup.id }).from(sectionGroup).where(and(eq(sectionGroup.siteId, s.id), eq(sectionGroup.kind, kind)));
      if (exists) continue;
      const documentId = await createDocument(s.id, "section_group", { root: { props: {} }, content: [] }, true);
      await db.insert(sectionGroup).values({ siteId: s.id, kind, documentId });
      log(`section group ${kind}`);
    }

    const [hasTheme] = await db.select({ id: theme.id }).from(theme).where(eq(theme.siteId, s.id));
    if (!hasTheme) {
      const input = themeFor(s.slug);
      const report = diagnoseTheme(input);
      await db.insert(theme).values({
        siteId: s.id,
        name: input.name,
        isActive: true,
        draft: input,
        published: input,
        publishedAt: new Date(),
        health: report.health,
        richness: report.richness.tier,
      });
      log(`theme ${input.name} (health ${report.health}, ${report.richness.tier})`);
    }

    const inserted = await db
      .insert(form)
      .values({ siteId: s.id, key: "contact", name: "Contact" })
      .onConflictDoNothing()
      .returning({ id: form.id });
    if (inserted.length) log("form contact");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
