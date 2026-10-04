import type { CSSProperties } from "react";
import { defineSection, f, linkTarget, resolveLink, resolveMedia, textOf } from "../../core";
import { CompareSlider } from "../compare";
import { IconGlyph } from "../icons";
import { aspectOptions, cx, Empty, radiusOptions } from "../shared";
import { columnsField, colsStyle, header, SectionHeader } from "./header";

export const FeatureGrid = defineSection({
  name: "FeatureGrid",
  label: "Features",
  description: "Grid of benefits or services, each with an icon or image, title, text and optional link.",
  category: "sections",
  icon: "layout-grid",
  keywords: ["benefits", "services", "usp", "icons"],
  fields: {
    header: header({ title: "Why choose us" }),
    items: f.list(
      {
        icon: f.icon({ label: "Icon", default: "check" }),
        image: f.media({ label: "Image (replaces icon)" }),
        title: f.text({ label: "Title", default: "Benefit" }),
        text: f.text({ label: "Text", multiline: true, default: "Explain the benefit in one sentence." }),
        link: f.link({ label: "Link" }),
      },
      {
        label: "Features",
        summary: "title",
        itemLabel: "Feature",
        default: [
          { icon: "wrench", title: "Installation" },
          { icon: "shield-check", title: "Certified" },
          { icon: "clock", title: "24/7 service" },
        ],
      },
    ),
    columns: columnsField(1, 2, 3),
    look: f.select(["plain", "card", "outline"], { label: "Item look", default: "plain", group: "style" }),
    iconStyle: f.select(["framed", "plain"], { label: "Icon style", default: "framed", group: "style" }),
    itemAlign: f.select(["start", "center"], { label: "Item alignment", default: "start", group: "layout" }),
  },
  render: ({ header: h, items, columns, look, iconStyle, itemAlign }, ctx) => (
    <>
      <SectionHeader value={h} ctx={ctx} />
      <div className="qb-grid" style={colsStyle(columns, "lg")}>
        {items.map((it, i) => {
          const img = resolveMedia(it.image, ctx.metadata);
          const href = resolveLink(it.link, ctx.metadata);
          return (
            <article key={i} className="qb-feature" data-look={look} style={{ textAlign: itemAlign, alignItems: itemAlign }}>
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="qb-feature-media" src={img.src} alt={img.alt} loading="lazy" />
              ) : it.icon ? (
                <span className="qb-icon" data-size="md" data-tone="primary" data-framed={iconStyle === "framed" || undefined}>
                  <IconGlyph name={it.icon} size="1em" />
                </span>
              ) : null}
              <h3 className="qb-heading qb-font-heading" style={{ fontSize: "var(--qb-step-1)" }}>
                {it.title}
              </h3>
              {it.text ? <p className="qb-muted">{it.text}</p> : null}
              {href ? (
                <a className="qb-button" data-emphasis="link" href={ctx.isEditing ? undefined : href} {...linkTarget(it.link)}>
                  Learn more <IconGlyph name="arrow-right" size="1em" />
                </a>
              ) : null}
            </article>
          );
        })}
      </div>
    </>
  ),
});

export const StatsBand = defineSection({
  name: "StatsBand",
  label: "Stats",
  description: "Row of key figures ('15+ years', '2,400 installs') with labels.",
  category: "sections",
  icon: "trending-up",
  fields: {
    header: header({ title: "" }),
    items: f.list(
      {
        value: f.text({ label: "Value", default: "100+", maxLength: 16 }),
        label: f.text({ label: "Label", default: "Happy clients" }),
      },
      {
        label: "Stats",
        summary: "value",
        itemLabel: "Stat",
        default: [
          { value: "15+", label: "Years of experience" },
          { value: "2,400", label: "Installations" },
          { value: "24/7", label: "Emergency service" },
        ],
      },
    ),
    columns: columnsField(1, 3, 3),
    dividers: f.toggle({ label: "Dividers between stats", default: true, group: "style" }),
  },
  render: ({ header: h, items, columns, dividers }, ctx) => (
    <>
      <SectionHeader value={h} ctx={ctx} />
      <div className="qb-grid qb-stats" data-dividers={dividers || undefined} style={colsStyle(columns, "md")}>
        {items.map((it, i) => (
          <div key={i} className="qb-stat" style={{ textAlign: "center" }}>
            <div className="qb-stat-value qb-font-display">{it.value}</div>
            <div className="qb-muted">{it.label}</div>
          </div>
        ))}
      </div>
    </>
  ),
});

const Stars = ({ rating }: { rating: number }) =>
  rating > 0 ? (
    <div className="qb-rating" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <IconGlyph key={i} name="star" size="1em" fill={i < rating ? "currentColor" : "none"} />
      ))}
    </div>
  ) : null;

export const Testimonials = defineSection({
  name: "Testimonials",
  label: "Testimonials",
  description: "Customer quotes with names, roles, photos and ratings as a grid or swipeable row.",
  category: "sections",
  icon: "quote",
  keywords: ["reviews", "social proof", "quotes"],
  fields: {
    header: header({ title: "What our clients say" }),
    items: f.list(
      {
        quote: f.text({ label: "Quote", multiline: true, default: "Fast, clean, professional work." }),
        author: f.text({ label: "Author", default: "Client name", translatable: false }),
        role: f.text({ label: "Role / company" }),
        avatar: f.media({ label: "Photo" }),
        rating: f.number({ label: "Rating", min: 0, max: 5, step: 1, default: 5 }),
      },
      { label: "Testimonials", summary: "author", itemLabel: "Testimonial", default: [{}, {}, {}] },
    ),
    layout: f.select(["grid", "carousel"], { label: "Layout", default: "grid", group: "layout" }),
    columns: columnsField(1, 2, 3),
    look: f.select(["card", "plain"], { label: "Look", default: "card", group: "style" }),
  },
  render: ({ header: h, items, layout, columns, look }, ctx) => (
    <>
      <SectionHeader value={h} ctx={ctx} />
      <div className={layout === "grid" ? "qb-grid" : "qb-rail"} style={colsStyle(columns, "md")}>
        {items.map((it, i) => {
          const img = resolveMedia(it.avatar, ctx.metadata);
          return (
            <figure key={i} className="qb-quote qb-testimonial" data-look={look}>
              <Stars rating={it.rating} />
              <blockquote className="qb-quote-text">{it.quote}</blockquote>
              <figcaption className="qb-quote-author">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="qb-avatar" src={img.src} alt={img.alt || it.author} loading="lazy" />
                ) : null}
                <span>
                  <strong>{it.author}</strong>
                  {it.role ? <span className="qb-muted" style={{ display: "block" }}>{it.role}</span> : null}
                </span>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </>
  ),
});

export const Faq = defineSection({
  name: "Faq",
  label: "FAQ",
  description: "Collapsible questions and answers (native <details>), with FAQ rich results for Google.",
  category: "sections",
  icon: "circle-help",
  keywords: ["questions", "accordion", "collapsible"],
  fields: {
    header: header({ title: "Frequently asked questions" }),
    items: f.list(
      {
        question: f.text({ label: "Question", default: "A common question?" }),
        answer: f.text({ label: "Answer", multiline: true, default: "A clear, short answer." }),
      },
      { label: "Questions", summary: "question", itemLabel: "Question", default: [{}, {}, {}] },
    ),
    layout: f.select(
      [
        { value: "stacked", label: "Header above" },
        { value: "side", label: "Header beside" },
      ],
      { label: "Layout", default: "stacked", group: "layout" },
    ),
    openFirst: f.toggle({ label: "Open first question", group: "layout" }),
    structuredData: f.toggle({ label: "FAQ rich results (SEO)", default: true, group: "advanced" }),
  },
  render: ({ header: h, items, layout, openFirst, structuredData }, ctx) => {
    const jsonLd = structuredData
      ? JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map((it) => ({
            "@type": "Question",
            name: textOf(it.question),
            acceptedAnswer: { "@type": "Answer", text: textOf(it.answer) },
          })),
        }).replace(/</g, "\\u003c")
      : null;
    return (
      <div className="qb-faq" data-layout={layout}>
        <SectionHeader value={{ ...h, align: layout === "side" ? "start" : h.align }} ctx={ctx} />
        <div className="qb-faq-items">
          {items.map((it, i) => (
            <details key={i} className="qb-faq-item" open={openFirst && i === 0 ? true : undefined} name={ctx.id || "faq"}>
              <summary>
                <span>{it.question}</span>
                <IconGlyph name="plus" size="1.1em" className="qb-faq-icon" />
              </summary>
              <p className="qb-muted" style={{ whiteSpace: "pre-line" }}>
                {it.answer}
              </p>
            </details>
          ))}
        </div>
        {jsonLd && !ctx.isEditing ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} /> : null}
      </div>
    );
  },
});

export const Marquee = defineSection({
  name: "Marquee",
  label: "Scrolling text",
  description: "Endless horizontal ticker of short phrases separated by an icon (pauses on hover).",
  category: "sections",
  icon: "move-horizontal",
  keywords: ["ticker", "marquee", "banner"],
  chrome: { width: "full", spacingTop: "sm", spacingBottom: "sm" },
  fields: {
    items: f.list(
      { text: f.text({ label: "Text", default: "Free delivery" }) },
      {
        label: "Phrases",
        summary: "text",
        itemLabel: "Phrase",
        default: [{ text: "Free delivery" }, { text: "Certified installers" }, { text: "24/7 service" }],
      },
    ),
    separator: f.icon({ label: "Separator", default: "sparkles" }),
    size: f.select(["1", "2", "3", "4"], { label: "Text size", default: "2", group: "style" }),
    speed: f.select(["slow", "normal", "fast"], { label: "Speed", default: "normal", group: "style" }),
    reverse: f.toggle({ label: "Scroll right", group: "style" }),
  },
  render: ({ items, separator, size, speed, reverse }) => {
    const run = (hidden: boolean) => (
      <div className="qb-marquee-run" aria-hidden={hidden || undefined}>
        {items.map((it, i) => (
          <span key={i} className="qb-marquee-item">
            <span>{it.text}</span>
            {separator ? <IconGlyph name={separator} size="0.8em" /> : null}
          </span>
        ))}
      </div>
    );
    return (
      <div
        className="qb-marquee qb-font-display"
        data-speed={speed}
        data-reverse={reverse || undefined}
        style={{ fontSize: `var(--qb-step-${size})` }}
      >
        {run(false)}
        {run(true)}
      </div>
    );
  },
});

export const LogoCloud = defineSection({
  name: "LogoCloud",
  label: "Logos",
  description: "Client, partner or brand logos as a grid or scrolling strip.",
  category: "sections",
  icon: "award",
  keywords: ["brands", "partners", "clients", "certifications"],
  fields: {
    header: header({ title: "Trusted by", align: "center" }),
    logos: f.list(
      {
        image: f.media({ label: "Logo" }),
        name: f.text({ label: "Name", default: "Brand", translatable: false }),
        link: f.link({ label: "Link" }),
      },
      { label: "Logos", summary: "name", itemLabel: "Logo", default: [{}, {}, {}, {}, {}] },
    ),
    layout: f.select(["grid", "marquee"], { label: "Layout", default: "grid", group: "layout" }),
    monochrome: f.toggle({ label: "Monochrome", default: true, group: "style" }),
    logoHeight: f.select(["sm", "md", "lg"], { label: "Logo height", default: "md", group: "style" }),
  },
  render: ({ header: h, logos, layout, monochrome, logoHeight }, ctx) => {
    const items = (hidden: boolean) =>
      logos.map((l, i) => {
        const img = resolveMedia(l.image, ctx.metadata);
        const href = resolveLink(l.link, ctx.metadata);
        const inner = img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img.src} alt={hidden ? "" : img.alt || l.name} loading="lazy" />
        ) : (
          <span className="qb-font-display">{l.name}</span>
        );
        return (
          <li key={i} className="qb-logo-item">
            {href && !ctx.isEditing ? (
              <a href={href} {...linkTarget(l.link)} tabIndex={hidden ? -1 : undefined}>
                {inner}
              </a>
            ) : (
              inner
            )}
          </li>
        );
      });
    return (
      <>
        <SectionHeader value={h} ctx={ctx} />
        {layout === "marquee" ? (
          <div className="qb-marquee" data-speed="slow">
            <ul className="qb-marquee-run qb-logos" data-mono={monochrome || undefined} data-size={logoHeight}>
              {items(false)}
            </ul>
            <ul className="qb-marquee-run qb-logos" aria-hidden="true" data-mono={monochrome || undefined} data-size={logoHeight}>
              {items(true)}
            </ul>
          </div>
        ) : (
          <ul className="qb-logos" data-mono={monochrome || undefined} data-size={logoHeight}>
            {items(false)}
          </ul>
        )}
      </>
    );
  },
});

export const Gallery = defineSection({
  name: "Gallery",
  label: "Gallery",
  description: "Image grid, masonry or swipeable row with a native lightbox; or a before/after comparison.",
  category: "sections",
  icon: "images",
  keywords: ["photos", "portfolio", "projects", "lightbox", "before after"],
  fields: {
    header: header({ title: "Our work" }),
    images: f.list(
      {
        image: f.media({ label: "Image" }),
        caption: f.text({ label: "Caption" }),
      },
      { label: "Images", summary: "caption", itemLabel: "Image", default: [{}, {}, {}, {}, {}, {}] },
    ),
    layout: f.select(["grid", "masonry", "carousel", "before-after"], { label: "Layout", default: "grid", group: "layout" }),
    columns: columnsField(2, 3, 3),
    aspect: f.select(aspectOptions.map((o) => o), { label: "Image ratio", default: "1/1", group: "style" }),
    radius: f.select(radiusOptions, { label: "Corners", default: "md", group: "style" }),
    lightbox: f.toggle({ label: "Open images in a lightbox", default: true, group: "advanced" }),
  },
  render: ({ header: h, images, layout, columns, aspect, radius, lightbox }, ctx) => {
    const resolved = images.map((it) => ({ ...it, media: resolveMedia(it.image, ctx.metadata) }));
    const style = {
      ...colsStyle(columns, "xs"),
      "--qb-media-aspect": aspect === "auto" || layout === "masonry" ? "auto" : aspect,
      "--qb-media-radius": `var(--qb-radius-${radius})`,
    } as CSSProperties;

    if (layout === "before-after") {
      const [before, after] = resolved;
      if (!before?.media || !after?.media) return <Empty label="Add a before and an after image" ctx={ctx} minHeight={240} />;
      return (
        <>
          <SectionHeader value={h} ctx={ctx} />
          <CompareSlider before={before.media} after={after.media} style={style} />
        </>
      );
    }

    return (
      <>
        <SectionHeader value={h} ctx={ctx} />
        <ul className={cx(layout === "carousel" ? "qb-rail" : "qb-grid", "qb-gallery")} data-layout={layout} style={style}>
          {resolved.map((it, i) => {
            const pid = `${ctx.id || "g"}-lb-${i}`;
            return (
              <li key={i}>
                <figure>
                  {it.media ? (
                    lightbox && !ctx.isEditing ? (
                      <button type="button" popoverTarget={pid} className="qb-gallery-open" aria-label={it.media.alt || `Open image ${i + 1}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={it.media.src} alt={it.media.alt} loading="lazy" style={{ objectPosition: it.media.objectPosition }} />
                      </button>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.media.src} alt={it.media.alt} loading="lazy" style={{ objectPosition: it.media.objectPosition }} />
                    )
                  ) : (
                    <Empty label="Image" ctx={ctx} minHeight={120} />
                  )}
                  {it.caption ? <figcaption className="qb-muted">{it.caption}</figcaption> : null}
                </figure>
                {it.media && lightbox && !ctx.isEditing ? (
                  <div id={pid} popover="auto" className="qb-lightbox">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.media.src} alt={it.media.alt} loading="lazy" />
                    <button type="button" popoverTarget={pid} popoverTargetAction="hide" className="qb-lightbox-close" aria-label="Close">
                      <IconGlyph name="x" size="1.25em" />
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </>
    );
  },
});

export const Process = defineSection({
  name: "Process",
  label: "Steps",
  description: "Numbered process or timeline: how it works, from first call to delivery.",
  category: "sections",
  icon: "list-ordered",
  keywords: ["how it works", "timeline", "process", "steps"],
  fields: {
    header: header({ title: "How it works" }),
    steps: f.list(
      {
        title: f.text({ label: "Title", default: "Step" }),
        text: f.text({ label: "Text", multiline: true, default: "What happens in this step." }),
        icon: f.icon({ label: "Icon (replaces number)" }),
      },
      {
        label: "Steps",
        summary: "title",
        itemLabel: "Step",
        default: [{ title: "Free assessment" }, { title: "Tailored quote" }, { title: "Installation" }],
      },
    ),
    layout: f.select(["horizontal", "vertical"], { label: "Layout", default: "horizontal", group: "layout" }),
  },
  render: ({ header: h, steps, layout }, ctx) => (
    <>
      <SectionHeader value={h} ctx={ctx} />
      <ol className="qb-steps" data-layout={layout} style={{ "--qb-cols-lg": steps.length } as CSSProperties}>
        {steps.map((s, i) => (
          <li key={i} className="qb-step">
            <span className="qb-step-marker qb-font-display" aria-hidden="true">
              {s.icon ? <IconGlyph name={s.icon} size="1em" /> : i + 1}
            </span>
            <div>
              <h3 className="qb-heading qb-font-heading" style={{ fontSize: "var(--qb-step-1)" }}>
                {s.title}
              </h3>
              <p className="qb-muted">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </>
  ),
});

export const PricingTable = defineSection({
  name: "PricingTable",
  label: "Pricing",
  description: "Plans or packages side by side with price, features and a button; highlight one.",
  category: "sections",
  icon: "badge-euro",
  keywords: ["plans", "packages", "subscriptions", "memberships"],
  fields: {
    header: header({ title: "Simple pricing" }),
    plans: f.list(
      {
        name: f.text({ label: "Name", default: "Plan" }),
        price: f.text({ label: "Price", default: "€49", translatable: false }),
        period: f.text({ label: "Period", default: "/ month" }),
        description: f.text({ label: "Description", multiline: true }),
        features: f.text({ label: "Features (one per line)", multiline: true, default: "Feature one\nFeature two", inline: false }),
        buttonLabel: f.text({ label: "Button label", default: "Choose" }),
        link: f.link({ label: "Button link" }),
        highlighted: f.toggle({ label: "Highlight" }),
        badge: f.text({ label: "Badge", placeholder: "Most popular" }),
      },
      {
        label: "Plans",
        summary: "name",
        itemLabel: "Plan",
        default: [{ name: "Essential" }, { name: "Plus", highlighted: true, badge: "Most popular" }, { name: "Pro" }],
      },
    ),
    columns: columnsField(1, 2, 3),
  },
  render: ({ header: h, plans, columns }, ctx) => (
    <>
      <SectionHeader value={h} ctx={ctx} />
      <div className="qb-grid" style={{ ...colsStyle(columns, "md"), alignItems: "stretch" }}>
        {plans.map((p, i) => {
          const href = resolveLink(p.link, ctx.metadata);
          return (
            <article key={i} className="qb-plan" data-highlighted={p.highlighted || undefined}>
              {p.badge ? <span className="qb-badge qb-font-accent" data-tone="accent">{p.badge}</span> : null}
              <h3 className="qb-heading qb-font-heading" style={{ fontSize: "var(--qb-step-1)" }}>
                {p.name}
              </h3>
              <p className="qb-price" data-size="lg">
                <strong className="qb-font-display">{p.price}</strong>
                {p.period ? <span className="qb-muted"> {p.period}</span> : null}
              </p>
              {p.description ? <p className="qb-muted">{p.description}</p> : null}
              <ul className="qb-list" data-marker="check">
                {p.features
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line, j) => (
                    <li key={j}>
                      <IconGlyph className="qb-list-icon" name="check" size="1.1em" />
                      <span>{line}</span>
                    </li>
                  ))}
              </ul>
              {p.buttonLabel ? (
                <a
                  className="qb-button"
                  data-emphasis={p.highlighted ? "primary" : "outline"}
                  href={ctx.isEditing ? undefined : href}
                  style={{ marginTop: "auto" }}
                  {...linkTarget(p.link)}
                >
                  {p.buttonLabel}
                </a>
              ) : null}
            </article>
          );
        })}
      </div>
    </>
  ),
});

export const Team = defineSection({
  name: "Team",
  label: "Team",
  description: "People with photo, name, role, short bio and a profile link.",
  category: "sections",
  icon: "users",
  keywords: ["staff", "people", "about", "instructors"],
  fields: {
    header: header({ title: "Meet the team" }),
    members: f.list(
      {
        photo: f.media({ label: "Photo" }),
        name: f.text({ label: "Name", default: "Name", translatable: false }),
        role: f.text({ label: "Role", default: "Role" }),
        bio: f.text({ label: "Bio", multiline: true }),
        link: f.link({ label: "Profile link" }),
      },
      { label: "Members", summary: "name", itemLabel: "Member", default: [{}, {}, {}] },
    ),
    columns: columnsField(1, 2, 3),
    photoAspect: f.select(["1/1", "3/4", "4/3"], { label: "Photo ratio", default: "3/4", group: "style" }),
  },
  render: ({ header: h, members, columns, photoAspect }, ctx) => (
    <>
      <SectionHeader value={h} ctx={ctx} />
      <div className="qb-grid" style={{ ...colsStyle(columns, "lg"), "--qb-media-aspect": photoAspect } as CSSProperties}>
        {members.map((m, i) => {
          const img = resolveMedia(m.photo, ctx.metadata);
          const href = resolveLink(m.link, ctx.metadata);
          return (
            <article key={i} className="qb-member">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img.src} alt={img.alt || m.name} loading="lazy" style={{ objectPosition: img.objectPosition }} />
              ) : (
                <Empty label="Photo" ctx={ctx} minHeight={160} />
              )}
              <h3 className="qb-heading qb-font-heading" style={{ fontSize: "var(--qb-step-1)" }}>
                {href && !ctx.isEditing ? (
                  <a href={href} {...linkTarget(m.link)}>
                    {m.name}
                  </a>
                ) : (
                  m.name
                )}
              </h3>
              <p className="qb-muted">{m.role}</p>
              {m.bio ? <p>{m.bio}</p> : null}
            </article>
          );
        })}
      </div>
    </>
  ),
});

export const listSections = [FeatureGrid, StatsBand, Testimonials, Faq, Marquee, LogoCloud, Gallery, Process, PricingTable, Team];
