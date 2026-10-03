import type { CSSProperties } from "react";
import { defineSection, f, linkTarget, resolveLink, resolveMedia, type SlotNode } from "../../core";
import { anchorFlex, anchorParts, aspectOptions, cx, Empty, gap, radiusOptions } from "../shared";
import { columnsField, colsStyle, header, SectionHeader } from "./header";

const node = (type: string, props: Record<string, unknown> = {}): SlotNode => ({ type, props });

const heroContent = (level: "h1" | "h2" = "h1") => [
  node("Eyebrow", { text: "Since 2008" }),
  node("Heading", { text: "Headline that says what you do", level, size: "6" }),
  node("Text", { body: "<p>One or two sentences that make the value obvious.</p>", size: "1", tone: "muted" }),
  node("ButtonGroup", {}),
];

/** Generic section: the chrome plus a free-form stack. The escape hatch for anything bespoke. */
export const Section = defineSection({
  name: "Section",
  label: "Section",
  description: "Empty section with color scheme, spacing and background; compose anything inside.",
  category: "sections",
  icon: "square-dashed",
  keywords: ["blank", "custom", "container"],
  fields: {
    content: f.slot({
      label: "Content",
      default: [node("Heading", { text: "New section" }), node("Text", {})],
    }),
    align: f.anchor({ label: "Content alignment", default: "top-left" }),
    gap: f.step("space", { label: "Gap", default: "sm" }),
    minHeight: f.select(["auto", "50vh", "75vh", "100vh"], { label: "Minimum height", default: "auto", group: "layout" }),
  },
  presets: [
    {
      id: "not-found",
      label: "404 — page not found",
      description: "Body for the system 404 page.",
      props: {
        align: "center",
        minHeight: "75vh",
        content: [
          node("Heading", { text: "404", level: "p", size: "6", font: "display", align: "center" }),
          node("Heading", { text: "We couldn't find that page", level: "h1", size: "3", align: "center" }),
          node("Text", { body: "<p>The link may be broken or the page may have moved.</p>", tone: "muted", align: "center" }),
          node("ButtonGroup", {
            align: "center",
            buttons: [node("Button", { label: "Back to home", link: { kind: "page", value: "home" } })],
          }),
        ],
      },
    },
  ],
  render: ({ content: Content, align, gap: g, minHeight }) => (
    <Content
      className="pk-stack"
      style={
        {
          "--pk-dir": "column",
          gap: gap(g),
          minHeight: minHeight === "auto" ? undefined : `calc(${minHeight} - var(--pk-section-pt) - var(--pk-section-pb))`,
          textAlign: anchorParts(align)[1] === "center" ? "center" : undefined,
          ...anchorFlex(align, "column"),
        } as CSSProperties
      }
    />
  ),
});

export const Hero = defineSection({
  name: "Hero",
  label: "Hero",
  description: "Opening section: headline, supporting text, buttons and a large image or video, in several layouts.",
  category: "sections",
  icon: "panel-top",
  keywords: ["banner", "header", "intro", "above the fold"],
  chrome: { spacingTop: "2xl", spacingBottom: "2xl" },
  fields: {
    content: f.slot({ label: "Content", default: heroContent() }),
    media: f.media({ label: "Image or video", accept: "any" }),
    layout: f.select(
      [
        { value: "split", label: "Split" },
        { value: "overlay", label: "Text over media" },
        { value: "stacked", label: "Media below" },
        { value: "typographic", label: "Text only" },
      ],
      { label: "Layout", default: "split", group: "layout" },
    ),
    mediaPosition: f.select(["end", "start"], { label: "Media side", default: "end", group: "layout" }),
    contentAnchor: f.anchor({ label: "Content position", default: "left", description: "Used by the overlay layout." }),
    minHeight: f.select(["auto", "60vh", "80vh", "100vh"], { label: "Minimum height", default: "auto", group: "layout" }),
    mediaAspect: f.select(aspectOptions.map((o) => o), { label: "Media ratio", default: "4/3", group: "style" }),
    mediaRadius: f.select(radiusOptions, { label: "Media corners", default: "xl", group: "style" }),
    overlay: f.number({ label: "Overlay darkness", min: 0, max: 90, step: 5, unit: "%", default: 40, group: "style" }),
  },
  presets: [
    { id: "split", label: "Split", props: { layout: "split" } },
    {
      id: "full-bleed",
      label: "Full-bleed media",
      props: { layout: "overlay", minHeight: "80vh", contentAnchor: "bottom-left", section: { width: "full" } },
    },
    {
      id: "typographic",
      label: "Typographic",
      props: {
        layout: "typographic",
        contentAnchor: "center",
        content: [
          node("Eyebrow", { text: "Since 2008", align: "center", look: "pill" }),
          node("Heading", { text: "Big idea, beautifully set", level: "h1", size: "6", font: "display", align: "center" }),
          node("Text", { body: "<p>A calm supporting sentence.</p>", size: "1", tone: "muted", align: "center" }),
          node("ButtonGroup", { align: "center" }),
        ],
      },
    },
    { id: "banner", label: "Image banner", props: { layout: "overlay", minHeight: "60vh", contentAnchor: "center" } },
  ],
  render: ({ content: Content, media, layout, mediaPosition, contentAnchor, minHeight, mediaAspect, mediaRadius, overlay }, ctx) => {
    const m = resolveMedia(media, ctx.metadata);
    const isVideo = m && /\.(mp4|webm|mov)(\?|$)/i.test(m.src);
    const mediaEl = m ? (
      isVideo ? (
        <video className="pk-hero-media" src={m.src} autoPlay muted loop playsInline />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="pk-hero-media" src={m.src} alt={m.alt} fetchPriority="high" style={{ objectPosition: m.objectPosition }} />
      )
    ) : layout === "typographic" ? null : (
      <Empty label="Add an image or video" ctx={ctx} minHeight={240} />
    );
    const [, h] = anchorParts(contentAnchor);
    const content = (
      <Content
        className="pk-stack pk-hero-content"
        style={
          {
            "--pk-dir": "column",
            gap: gap("sm"),
            textAlign: layout === "typographic" || (layout === "overlay" && h === "center") ? "center" : undefined,
            ...anchorFlex(layout === "overlay" || layout === "typographic" ? contentAnchor : "left", "column"),
          } as CSSProperties
        }
      />
    );
    return (
      <div
        className="pk-hero"
        data-layout={layout}
        data-media-position={mediaPosition}
        style={
          {
            minHeight: minHeight === "auto" ? undefined : `calc(${minHeight} - var(--pk-section-pt) - var(--pk-section-pb))`,
            "--pk-media-aspect": mediaAspect === "auto" ? "auto" : mediaAspect,
            "--pk-media-radius": `var(--pk-radius-${mediaRadius})`,
            "--pk-overlay": overlay / 100,
            ...(layout === "overlay" ? anchorFlex(contentAnchor, "column") : {}),
          } as CSSProperties
        }
      >
        {layout === "overlay" ? (
          <>
            <div className="pk-hero-backdrop" aria-hidden="true">
              {mediaEl}
            </div>
            {content}
          </>
        ) : (
          <>
            {content}
            {mediaEl ? <div className="pk-hero-figure">{mediaEl}</div> : null}
          </>
        )}
      </div>
    );
  },
});

export const SplitMedia = defineSection({
  name: "SplitMedia",
  label: "Image with text",
  description: "Image or video beside free content; alternate sides to build a story down the page.",
  category: "sections",
  icon: "columns-2",
  keywords: ["image with text", "split", "media", "about"],
  fields: {
    media: f.media({ label: "Image or video", accept: "any" }),
    content: f.slot({
      label: "Content",
      default: [
        node("Eyebrow", { text: "Our approach" }),
        node("Heading", { text: "Explain one idea clearly" }),
        node("Text", { body: "<p>Support it with a short paragraph and a single call to action.</p>", tone: "muted" }),
        node("ButtonGroup", { buttons: [node("Button", { label: "Learn more", emphasis: "outline" })] }),
      ],
    }),
    mediaPosition: f.select(["start", "end"], { label: "Media side", default: "start", group: "layout" }),
    ratio: f.select(["1:1", "3:2", "2:3"], { label: "Media : text", default: "1:1", group: "layout" }),
    verticalAlign: f.select(["start", "center", "end"], { label: "Vertical alignment", default: "center", group: "layout" }),
    mediaAspect: f.select(aspectOptions.map((o) => o), { label: "Media ratio", default: "4/3", group: "style" }),
    mediaRadius: f.select(radiusOptions, { label: "Media corners", default: "lg", group: "style" }),
    bleed: f.toggle({ label: "Media bleeds to the edge", group: "style", audience: "builder" }),
  },
  render: ({ media, content: Content, mediaPosition, ratio, verticalAlign, mediaAspect, mediaRadius, bleed }, ctx) => {
    const m = resolveMedia(media, ctx.metadata);
    const isVideo = m && /\.(mp4|webm|mov)(\?|$)/i.test(m.src);
    const [a, b] = ratio.split(":").map(Number) as [number, number];
    return (
      <div
        className="pk-split"
        data-media-position={mediaPosition}
        data-bleed={bleed || undefined}
        style={
          {
            "--pk-col-a": `${a}fr`,
            "--pk-col-b": `${b}fr`,
            alignItems: verticalAlign,
            "--pk-media-aspect": mediaAspect === "auto" ? "auto" : mediaAspect,
            "--pk-media-radius": `var(--pk-radius-${mediaRadius})`,
          } as CSSProperties
        }
      >
        <div className="pk-split-media">
          {m ? (
            isVideo ? (
              <video src={m.src} autoPlay muted loop playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.src} alt={m.alt} loading="lazy" style={{ objectPosition: m.objectPosition }} />
            )
          ) : (
            <Empty label="Add an image or video" ctx={ctx} minHeight={240} />
          )}
        </div>
        <Content className="pk-stack" style={{ "--pk-dir": "column", gap: gap("sm") } as CSSProperties} />
      </div>
    );
  },
});

export const RichText = defineSection({
  name: "RichText",
  label: "Rich text",
  description: "Centered reading column for headings, paragraphs and buttons — about text, policies, intros.",
  category: "sections",
  icon: "text",
  chrome: { width: "narrow" },
  fields: {
    content: f.slot({
      label: "Content",
      default: [
        node("Heading", { text: "Talk about your brand", align: "inherit" }),
        node("Text", { body: "<p>Share information about your business, your story, or a policy your customers should know.</p>" }),
      ],
    }),
    align: f.select(["start", "center"], { label: "Alignment", default: "center", group: "layout" }),
  },
  render: ({ content: Content, align }) => (
    <Content
      className="pk-stack pk-rich-text"
      style={{ "--pk-dir": "column", gap: gap("sm"), textAlign: align, alignItems: align === "center" ? "center" : "stretch", ...(align === "start" ? { marginInline: 0 } : {}) } as CSSProperties}
    />
  ),
});

export const CtaBand = defineSection({
  name: "CtaBand",
  label: "Call to action",
  description: "Short persuasive band with a heading and buttons, optionally inside a colored panel.",
  category: "sections",
  icon: "megaphone",
  keywords: ["cta", "banner", "conversion"],
  fields: {
    content: f.slot({
      label: "Content",
      default: [
        node("Heading", { text: "Ready when you are", size: "4" }),
        node("Text", { body: "<p>Get a free quote within 24 hours.</p>", tone: "muted" }),
        node("ButtonGroup", { buttons: [node("Button", { label: "Request a quote" })] }),
      ],
    }),
    layout: f.select(
      [
        { value: "centered", label: "Centered" },
        { value: "row", label: "Text left, buttons right" },
      ],
      { label: "Layout", default: "centered", group: "layout" },
    ),
    panel: f.scheme({ label: "Panel scheme", description: "Paint the band as an inset panel; empty = no panel." }),
  },
  render: ({ content: Content, layout, panel }) => (
    <div className="pk-cta" data-layout={layout} data-panel={panel ? true : undefined} data-scheme={panel || undefined}>
      <Content className="pk-cta-content" />
    </div>
  ),
});

export const CardGrid = defineSection({
  name: "CardGrid",
  label: "Card grid",
  description: "Header plus a responsive grid of cards; each card is freely editable.",
  category: "sections",
  icon: "layout-grid",
  fields: {
    header: header({ title: "Explore" }),
    cards: f.slot({
      label: "Cards",
      allow: ["Card"],
      default: [node("Card", {}), node("Card", {}), node("Card", {})],
    }),
    columns: columnsField(1, 2, 3),
    gap: f.step("space", { label: "Gap", default: "md" }),
  },
  render: ({ header: h, cards: Cards, columns, gap: g }, ctx) => (
    <>
      <SectionHeader value={h} ctx={ctx} />
      <Cards className="pk-grid" style={colsStyle(columns, g)} />
    </>
  ),
});

export const Slideshow = defineSection({
  name: "Slideshow",
  label: "Slideshow",
  description: "Swipeable full-width slides, each with media, text and a button (CSS scroll-snap, no JS).",
  category: "sections",
  icon: "gallery-horizontal",
  keywords: ["carousel", "slider", "hero carousel"],
  chrome: { width: "full", spacingTop: "none", spacingBottom: "none" },
  fields: {
    slides: f.list(
      {
        media: f.media({ label: "Image" }),
        eyebrow: f.text({ label: "Eyebrow" }),
        title: f.text({ label: "Title", default: "Slide headline" }),
        text: f.text({ label: "Text", multiline: true }),
        buttonLabel: f.text({ label: "Button label", default: "Discover" }),
        link: f.link({ label: "Button link" }),
      },
      { label: "Slides", summary: "title", itemLabel: "Slide", min: 1, default: [{}, {}] },
    ),
    height: f.select(["60vh", "80vh", "100vh"], { label: "Height", default: "80vh", group: "layout" }),
    contentAnchor: f.anchor({ label: "Text position", default: "bottom-left" }),
    overlay: f.number({ label: "Overlay darkness", min: 0, max: 90, step: 5, unit: "%", default: 35, group: "style" }),
  },
  render: ({ slides, height, contentAnchor, overlay }, ctx) => (
    <div
      className="pk-slideshow"
      style={{ "--pk-slide-h": height, "--pk-overlay": overlay / 100 } as CSSProperties}
      role="region"
      aria-roledescription="carousel"
    >
      {slides.map((s, i) => {
        const m = resolveMedia(s.media, ctx.metadata);
        return (
          <div className="pk-slide" key={i} aria-label={`${i + 1} / ${slides.length}`} style={anchorFlex(contentAnchor, "column")}>
            {m ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.src} alt={m.alt} loading={i === 0 ? "eager" : "lazy"} style={{ objectPosition: m.objectPosition }} />
            ) : null}
            <div className={cx("pk-slide-content", "pk-stack")} style={{ "--pk-dir": "column", gap: gap("xs") } as CSSProperties}>
              {s.eyebrow ? <p className="pk-eyebrow pk-font-accent">{s.eyebrow}</p> : null}
              {s.title ? (
                <h2 className="pk-heading pk-font-display" style={{ fontSize: "var(--pk-step-5)" }}>
                  {s.title}
                </h2>
              ) : null}
              {s.text ? <p>{s.text}</p> : null}
              {s.buttonLabel && resolveLink(s.link, ctx.metadata) ? (
                <a className="pk-button" href={ctx.isEditing ? undefined : resolveLink(s.link, ctx.metadata)} {...linkTarget(s.link)}>
                  {s.buttonLabel}
                </a>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  ),
});

export const composableSections = [Section, Hero, SplitMedia, RichText, CtaBand, CardGrid, Slideshow];
