import type { CSSProperties, ReactNode } from "react";
import { resolveMedia, type BlockContext } from "./context";
import { entranceOptions, f, type InferValues } from "./fields";

/**
 * Section Chrome — the settings every section gets for free.
 *
 * Shopify makes each section author re-declare "background", "padding",
 * "section id"… so every section ends up slightly different. Here they are
 * declared once; add a control here and every section in every site gains it.
 */
export const edgeShapes = ["none", "angle", "curve", "wave", "zigzag"] as const;
export type EdgeShape = (typeof edgeShapes)[number];

export const sectionChromeFields = {
  scheme: f.scheme({ label: "Color scheme", description: "Named palette from the theme. Empty inherits the page scheme." }),
  width: f.select(["narrow", "content", "wide", "full"], { label: "Width", default: "content", group: "layout" }),
  spacingTop: f.step("space", { label: "Top spacing", default: "xl", group: "layout" }),
  spacingBottom: f.step("space", { label: "Bottom spacing", default: "xl", group: "layout" }),
  background: f.group(
    {
      media: f.media({ label: "Background media", accept: "any", translatableAlt: false }),
      overlay: f.number({ label: "Overlay", min: 0, max: 90, step: 5, unit: "%", default: 0 }),
      fit: f.select(["cover", "contain"], { label: "Fit", default: "cover" }),
    },
    { label: "Background", group: "style" },
  ),
  edges: f.group(
    {
      top: f.select(edgeShapes, { label: "Top edge", default: "none" }),
      bottom: f.select(edgeShapes, { label: "Bottom edge", default: "none" }),
      height: f.step("space", { label: "Edge height", default: "lg", min: "sm", max: "3xl" }),
    },
    { label: "Edges", group: "style" },
  ),
  art: f.group(
    {
      media: f.media({ label: "Artwork", translatableAlt: false }),
      placement: f.anchor({ label: "Placement", default: "top-right" }),
      size: f.number({ label: "Size", min: 5, max: 100, step: 5, unit: "%", default: 30 }),
      opacity: f.number({ label: "Opacity", min: 0, max: 100, step: 5, unit: "%", default: 100 }),
    },
    { label: "Section art", group: "style", audience: "builder" },
  ),
  entrance: f.select(entranceOptions, { label: "Entrance animation", default: "inherit", group: "style" }),
  hideOn: f.group(
    {
      mobile: f.toggle({ label: "Hide on mobile" }),
      tablet: f.toggle({ label: "Hide on tablet" }),
      desktop: f.toggle({ label: "Hide on desktop" }),
    },
    { label: "Visibility", group: "advanced" },
  ),
  anchorId: f.anchorId(),
  locked: f.toggle({
    label: "Lock section",
    description: "Prevents merchants from moving or deleting this section.",
    group: "advanced",
    audience: "builder",
  }),
};

export const sectionChrome = f.group(sectionChromeFields, { label: "Section", collapsed: false });
export type SectionChromeValue = InferValues<typeof sectionChromeFields>;

// Edge paths in a 100×10 box, drawn in the section's own background colour
// and protruding outside it (bottom edge below, top edge mirrored above).
const edgePaths: Record<Exclude<EdgeShape, "none">, string> = {
  angle: "M0,0 H100 L0,10 Z",
  curve: "M0,0 H100 Q50,20 0,0 Z",
  wave: "M0,0 H100 V3 C80,12 60,-2 40,6 C25,12 10,4 0,7 Z",
  zigzag: `M0,0 H100 V2 ${Array.from({ length: 20 }, (_, i) => `L${100 - (i * 5 + 2.5)},${i % 2 ? 2 : 10}`).join(" ")} L0,2 Z`,
};

function Edge({ side, shape }: { side: "top" | "bottom"; shape: EdgeShape }) {
  if (shape === "none") return null;
  return (
    <svg className="qb-edge" data-edge-side={side} viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
      <path d={edgePaths[shape]} fill="currentColor" />
    </svg>
  );
}

const anchorToPosition: Record<string, CSSProperties> = {
  "top-left": { top: 0, left: 0 },
  top: { top: 0, left: "50%", translate: "-50% 0" },
  "top-right": { top: 0, right: 0 },
  left: { top: "50%", left: 0, translate: "0 -50%" },
  center: { top: "50%", left: "50%", translate: "-50% -50%" },
  right: { top: "50%", right: 0, translate: "0 -50%" },
  "bottom-left": { bottom: 0, left: 0 },
  bottom: { bottom: 0, left: "50%", translate: "-50% 0" },
  "bottom-right": { bottom: 0, right: 0 },
};

export function SectionChrome({
  type,
  value,
  ctx,
  children,
}: {
  type: string;
  value: Partial<SectionChromeValue> | undefined;
  ctx: BlockContext;
  children: ReactNode;
}) {
  const v = { ...defaultChrome, ...value };
  const bg = resolveMedia(v.background?.media, ctx.metadata);
  const art = resolveMedia(v.art?.media, ctx.metadata);
  const isVideo = bg && /\.(mp4|webm|mov)(\?|$)/i.test(bg.src);
  const hasEdges = v.edges?.top !== "none" || v.edges?.bottom !== "none";
  const style = {
    "--qb-section-pt": `var(--qb-gap-${v.spacingTop})`,
    "--qb-section-pb": `var(--qb-gap-${v.spacingBottom})`,
    ...(hasEdges ? { "--qb-edge-height": `var(--qb-gap-${v.edges?.height ?? "lg"})` } : {}),
  } as CSSProperties;

  return (
    <section
      id={v.anchorId || undefined}
      className="qb-section"
      data-block={type}
      data-scheme={v.scheme || undefined}
      data-width={v.width}
      data-entrance={v.entrance === "inherit" ? undefined : v.entrance}
      data-edges={hasEdges || undefined}
      data-hide-mobile={v.hideOn?.mobile || undefined}
      data-hide-tablet={v.hideOn?.tablet || undefined}
      data-hide-desktop={v.hideOn?.desktop || undefined}
      style={style}
    >
      {bg ? (
        <div className="qb-section-bg" aria-hidden="true">
          {isVideo ? (
            <video src={bg.src} autoPlay muted loop playsInline style={{ objectFit: v.background.fit }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bg.src} alt="" style={{ objectFit: v.background.fit, objectPosition: bg.objectPosition }} />
          )}
          {v.background.overlay > 0 ? (
            <div
              style={{ position: "absolute", inset: 0, background: "var(--qb-background)", opacity: v.background.overlay / 100 }}
            />
          ) : null}
        </div>
      ) : null}
      {art ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="qb-section-art"
          src={art.src}
          alt=""
          aria-hidden="true"
          style={{ ...anchorToPosition[v.art.placement], width: `${v.art.size}%`, opacity: v.art.opacity / 100 }}
        />
      ) : null}
      <Edge side="top" shape={v.edges?.top ?? "none"} />
      <div className="qb-container">{children}</div>
      <Edge side="bottom" shape={v.edges?.bottom ?? "none"} />
    </section>
  );
}

const defaultChrome = sectionChrome.default;
