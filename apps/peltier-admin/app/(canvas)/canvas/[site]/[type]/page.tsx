import { notFound } from "next/navigation";
import { blueprintNode, instantiate, registry, type DocumentData } from "@peltier/blocks";
import { sampleProducts } from "@peltier/blocks/fixtures";
import { PeltierRender } from "@peltier/blocks/render";
import { requireSite } from "@/lib/admin";
import { resolveCanvasTheme, siteMeta } from "@/lib/studio";

type Search = { preset?: string; mode?: string; theme?: string; thumb?: string };

/** Renders one library block, themed, as a standalone document for iframes. */
export default async function BlockCanvas({ params, searchParams }: { params: Promise<{ site: string; type: string }>; searchParams: Promise<Search> }) {
  const [{ site: slug, type }, sp] = await Promise.all([params, searchParams]);
  const { site, siteId } = await requireSite(slug);
  const def = registry.get(type);
  if (!def) notFound();
  const theme = await resolveCanvasTheme(siteId, sp.theme);
  const preset = def.presets.some((p) => p.id === sp.preset) ? sp.preset : undefined;
  const blueprint = sp.mode === "blueprint";

  let node = instantiate(registry, type, { preset });
  // Layout primitives are empty boxes by default; give their slots demo cards.
  if (def.kind === "layout") {
    const demo = () => instantiate(registry, "Card");
    const props = { ...node.props };
    for (const [key, field] of Object.entries(def.fields)) {
      if (field.kind === "slot" && Array.isArray(props[key]) && !(props[key] as unknown[]).length) props[key] = [demo(), demo(), demo()];
    }
    node = { ...node, props };
  }
  if (blueprint) node = blueprintNode(registry, node);
  const data: DocumentData = { root: { props: {} }, content: [node] };
  const isSection = def.kind === "section";
  const thumb = sp.thumb === "1" && !isSection;

  return (
    <div
      data-canvas-kind={def.kind}
      style={
        isSection
          ? undefined
          : thumb
            ? { minHeight: "100vh", display: "grid", alignItems: "center", padding: "24px 32px", boxSizing: "border-box" }
            : { padding: "clamp(16px, 4vw, 48px)" }
      }
    >
      <PeltierRender
        registry={registry}
        data={data}
        metadata={{
          theme,
          locale: "fr",
          site: siteMeta(site),
          blueprint,
          data: blueprint ? {} : { [node.props.id as string]: sampleProducts },
        }}
      />
    </div>
  );
}
