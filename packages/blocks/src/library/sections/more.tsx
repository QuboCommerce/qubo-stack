import type { CSSProperties } from "react";
import { defineSection, f, linkTarget, resolveLink } from "../../core";
import { IconGlyph } from "../icons";
import { cx, gap } from "../shared";
import { columnsField, colsStyle, header, SectionHeader } from "./header";
import { embedSrc } from "../elements";

/**
 * Forms post to the platform form endpoint (`/api/forms/:key`), which stores a
 * submission and triggers notifications. The key ties the block to a form
 * record so submissions from several pages land in one inbox.
 */
export const formAction = (key: string) => `/api/forms/${encodeURIComponent(key || "contact")}`;

export const Newsletter = defineSection({
  name: "Newsletter",
  label: "Newsletter",
  description: "Email sign-up with heading, short pitch and consent note.",
  category: "sections",
  icon: "mail",
  keywords: ["email", "subscribe", "mailing list"],
  fields: {
    header: header({ title: "Stay in the loop", intro: "News and offers, never spam." }),
    placeholder: f.text({ label: "Placeholder", default: "Your email", inline: false }),
    buttonLabel: f.text({ label: "Button label", default: "Subscribe" }),
    consent: f.text({ label: "Consent note", multiline: true, default: "You can unsubscribe at any time." }),
    formKey: f.text({ label: "Form key", default: "newsletter", translatable: false, group: "advanced", audience: "builder" }),
    layout: f.select(["inline", "stacked"], { label: "Layout", default: "inline", group: "layout" }),
  },
  render: ({ header: h, placeholder, buttonLabel, consent, formKey, layout }, ctx) => (
    <div className="qb-newsletter" data-align={h.align}>
      <SectionHeader value={h} ctx={ctx} />
      <form className="qb-form-inline" data-layout={layout} method="post" action={formAction(formKey)}>
        <label className="qb-sr-only" htmlFor={`${ctx.id}-email`}>
          {placeholder}
        </label>
        <input className="qb-input" id={`${ctx.id}-email`} name="email" type="email" required placeholder={placeholder} autoComplete="email" />
        <button className="qb-button" data-emphasis="primary" type={ctx.isEditing ? "button" : "submit"}>
          {buttonLabel}
        </button>
      </form>
      {consent ? <p className="qb-muted qb-small">{consent}</p> : null}
    </div>
  ),
});

export const ContactForm = defineSection({
  name: "ContactForm",
  label: "Contact form",
  description: "Configurable enquiry / quote form with optional contact details beside it.",
  category: "sections",
  icon: "message-square",
  keywords: ["contact", "quote", "lead", "enquiry", "form"],
  fields: {
    header: header({ title: "Get in touch", align: "start" }),
    fields: f.list(
      {
        label: f.text({ label: "Label", default: "Field" }),
        name: f.text({ label: "Name (key)", default: "field", translatable: false }),
        type: f.select(["text", "email", "tel", "textarea", "select", "number", "date", "file"], {
          label: "Type",
          default: "text",
        }),
        required: f.toggle({ label: "Required" }),
        options: f.text({ label: "Options (one per line, select only)", multiline: true, inline: false }),
        width: f.select(["full", "half"], { label: "Width", default: "full" }),
      },
      {
        label: "Fields",
        summary: "label",
        itemLabel: "Field",
        default: [
          { label: "Name", name: "name", required: true, width: "half" },
          { label: "Email", name: "email", type: "email", required: true, width: "half" },
          { label: "Phone", name: "phone", type: "tel" },
          { label: "Message", name: "message", type: "textarea", required: true },
        ],
      },
    ),
    submitLabel: f.text({ label: "Submit label", default: "Send" }),
    successMessage: f.text({ label: "Success message", default: "Thanks! We'll get back to you within one business day.", inline: false }),
    formKey: f.text({ label: "Form key", default: "contact", translatable: false, group: "advanced", audience: "builder" }),
    details: f.group(
      {
        show: f.toggle({ label: "Show contact details", default: true }),
        phone: f.text({ label: "Phone", translatable: false }),
        email: f.text({ label: "Email", translatable: false }),
        address: f.text({ label: "Address", multiline: true, translatable: false }),
        hours: f.text({ label: "Opening hours", multiline: true }),
      },
      { label: "Contact details" },
    ),
  },
  render: ({ header: h, fields, submitLabel, successMessage, formKey, details }, ctx) => {
    const lines = [
      details.phone && { icon: "phone", text: details.phone, href: `tel:${details.phone.replace(/[^\d+]/g, "")}` },
      details.email && { icon: "mail", text: details.email, href: `mailto:${details.email}` },
      details.address && { icon: "map-pin", text: details.address },
      details.hours && { icon: "clock", text: details.hours },
    ].filter(Boolean) as { icon: string; text: string; href?: string }[];
    const aside = details.show && lines.length > 0;
    return (
      <div className="qb-contact" data-aside={aside || undefined}>
        <div className="qb-stack" style={{ "--qb-dir": "column", gap: gap("md") } as CSSProperties}>
          <SectionHeader value={h} ctx={ctx} />
          {aside ? (
            <ul className="qb-contact-details">
              {lines.map((l, i) => (
                <li key={i}>
                  <IconGlyph name={l.icon} size="1.1em" />
                  {l.href && !ctx.isEditing ? <a href={l.href}>{l.text}</a> : <span style={{ whiteSpace: "pre-line" }}>{l.text}</span>}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <form
          className="qb-form"
          method="post"
          action={formAction(formKey)}
          encType={fields.some((x) => x.type === "file") ? "multipart/form-data" : undefined}
          data-success={successMessage}
        >
          {fields.map((fd, i) => {
            const id = `${ctx.id}-${fd.name || i}`;
            const common = { id, name: fd.name, required: fd.required, className: "qb-input" };
            return (
              <div key={i} className="qb-field" data-width={fd.width}>
                <label htmlFor={id}>
                  {fd.label}
                  {fd.required ? <span aria-hidden="true"> *</span> : null}
                </label>
                {fd.type === "textarea" ? (
                  <textarea {...common} rows={5} />
                ) : fd.type === "select" ? (
                  <select {...common} defaultValue="">
                    <option value="" disabled>
                      —
                    </option>
                    {fd.options
                      .split("\n")
                      .map((o) => o.trim())
                      .filter(Boolean)
                      .map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                  </select>
                ) : (
                  <input {...common} type={fd.type} autoComplete={fd.type === "email" ? "email" : fd.type === "tel" ? "tel" : undefined} />
                )}
              </div>
            );
          })}
          <button className="qb-button" data-emphasis="primary" type={ctx.isEditing ? "button" : "submit"}>
            {submitLabel}
          </button>
        </form>
      </div>
    );
  },
});

export const MapSection = defineSection({
  name: "Map",
  label: "Map",
  description: "Google map of an address with optional location details beside it.",
  category: "sections",
  icon: "map-pin",
  keywords: ["location", "address", "directions", "store"],
  fields: {
    header: header({ title: "Visit us", align: "start" }),
    address: f.text({ label: "Address", multiline: true, default: "Grand-Place 1, 1000 Brussels", translatable: false }),
    embedUrl: f.text({ label: "Custom embed URL", translatable: false, group: "advanced", description: "Google Maps embed link; overrides the address." }),
    height: f.select(["sm", "md", "lg"], { label: "Height", default: "md", group: "style" }),
    showDetails: f.toggle({ label: "Show address beside map", default: true, group: "layout" }),
    directionsLabel: f.text({ label: "Directions button", default: "Get directions" }),
  },
  render: ({ header: h, address, embedUrl, height, showDetails, directionsLabel }, ctx) => {
    const q = encodeURIComponent(address.replace(/\n/g, ", "));
    const src = (embedUrl && embedSrc(embedUrl)) || `https://maps.google.com/maps?q=${q}&output=embed`;
    return (
      <div className="qb-map" data-details={showDetails || undefined}>
        {showDetails ? (
          <div className="qb-stack" style={{ "--qb-dir": "column", gap: gap("sm") } as CSSProperties}>
            <SectionHeader value={h} ctx={ctx} />
            <p style={{ whiteSpace: "pre-line" }}>{address}</p>
            {directionsLabel ? (
              <a
                className="qb-button"
                data-emphasis="outline"
                href={ctx.isEditing ? undefined : `https://www.google.com/maps/dir/?api=1&destination=${q}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <IconGlyph name="navigation" size="1em" /> {directionsLabel}
              </a>
            ) : null}
          </div>
        ) : null}
        <iframe className="qb-map-frame" data-size={height} src={src} title={address} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
      </div>
    );
  },
});

export const AnnouncementBar = defineSection({
  name: "AnnouncementBar",
  label: "Announcement bar",
  description: "Thin strip for a promo, shipping note or notice, optionally linked.",
  category: "site",
  icon: "megaphone",
  keywords: ["promo", "notice", "top bar", "banner"],
  chrome: { width: "wide", spacingTop: "2xs", spacingBottom: "2xs", entrance: "none" },
  fields: {
    messages: f.list(
      {
        text: f.text({ label: "Text", default: "Free delivery in Belgium from €100" }),
        link: f.link({ label: "Link" }),
      },
      { label: "Messages", summary: "text", itemLabel: "Message", min: 1, default: [{}] },
    ),
    icon: f.icon({ label: "Icon" }),
    size: f.select(["-1", "0"], { label: "Text size", default: "-1", group: "style" }),
  },
  render: ({ messages, icon, size }, ctx) => (
    <div className="qb-announcement" style={{ fontSize: `var(--qb-step-${size === "-1" ? "n1" : "0"})` }}>
      {messages.map((m, i) => {
        const href = resolveLink(m.link, ctx.metadata);
        const body = (
          <>
            {icon ? <IconGlyph name={icon} size="1em" /> : null}
            <span>{m.text}</span>
          </>
        );
        return (
          <p key={i} className="qb-announcement-item">
            {href && !ctx.isEditing ? (
              <a href={href} {...linkTarget(m.link)}>
                {body}
              </a>
            ) : (
              body
            )}
          </p>
        );
      })}
    </div>
  ),
});

// ----------------------------------------------------- data-bound (v1) ---

export type ProductCard = {
  title: string;
  href: string;
  image?: { src: string; alt: string };
  price?: string;
  compareAt?: string;
  badge?: string;
};

const placeholderProducts = (n: number): ProductCard[] =>
  Array.from({ length: n }, (_, i) => ({ title: `Product ${i + 1}`, href: "#", price: "€ —" }));

/**
 * Data comes from `metadata.data[nodeId]` — the host resolves the source
 * (collection / manual list / query) before render. In the editor without
 * data we show placeholders so the layout can still be designed.
 */
export const ProductGrid = defineSection({
  name: "ProductGrid",
  label: "Product grid",
  description: "Products from a collection, a manual pick or the newest arrivals.",
  category: "commerce",
  icon: "shopping-bag",
  requires: ["commerce"],
  keywords: ["products", "collection", "shop", "featured"],
  fields: {
    header: header({ title: "Featured products", align: "start" }),
    source: f.select(
      [
        { value: "collection", label: "Collection" },
        { value: "manual", label: "Pick products" },
        { value: "newest", label: "Newest" },
        { value: "search", label: "Search results" },
      ],
      { label: "Source", default: "collection" },
    ),
    collection: f.text({ label: "Collection handle", translatable: false }),
    products: f.text({ label: "Product handles (one per line)", multiline: true, translatable: false }),
    limit: f.number({ label: "Maximum products", min: 1, max: 24, step: 1, default: 8 }),
    columns: columnsField(2, 3, 4),
    imageAspect: f.select(["1/1", "4/5", "3/4", "4/3"], { label: "Image ratio", default: "1/1", group: "style" }),
    showPrice: f.toggle({ label: "Show price", default: true, group: "style" }),
    emptyText: f.text({ label: "Text when nothing matches", default: "No products found.", inline: false }),
  },
  render: ({ header: h, limit, columns, imageAspect, showPrice, emptyText }, ctx) => {
    const data = ctx.metadata.data?.[ctx.id] as ProductCard[] | undefined;
    const items = (data ?? (ctx.isEditing || ctx.metadata.blueprint ? placeholderProducts(limit) : [])).slice(0, limit);
    return (
      <>
        <SectionHeader value={h} ctx={ctx} />
        {!items.length && emptyText ? <p className="qb-muted qb-products-empty">{emptyText}</p> : null}
        <ul className="qb-grid qb-products" style={{ ...colsStyle(columns, "md"), "--qb-media-aspect": imageAspect } as CSSProperties}>
          {items.map((p, i) => (
            <li key={i} className="qb-product-card">
              <a href={ctx.isEditing ? undefined : p.href}>
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image.src} alt={p.image.alt} loading="lazy" />
                ) : (
                  <span className="qb-media-placeholder" aria-hidden="true" />
                )}
                {p.badge ? <span className="qb-badge" data-tone="accent">{p.badge}</span> : null}
                <span className="qb-product-title">{p.title}</span>
                {showPrice && p.price ? (
                  <span className="qb-price" data-size="sm">
                    <strong>{p.price}</strong>
                    {p.compareAt ? <s className="qb-muted">{p.compareAt}</s> : null}
                  </span>
                ) : null}
              </a>
            </li>
          ))}
        </ul>
      </>
    );
  },
});

export type PostCard = { title: string; href: string; excerpt?: string; date?: string; image?: { src: string; alt: string } };

export const PostList = defineSection({
  name: "PostList",
  label: "Blog posts",
  description: "Latest articles from the blog as cards.",
  category: "blog",
  icon: "newspaper",
  requires: ["blog"],
  keywords: ["blog", "articles", "news"],
  fields: {
    header: header({ title: "From the blog", align: "start" }),
    tag: f.text({ label: "Only posts tagged", translatable: false }),
    limit: f.number({ label: "Number of posts", min: 1, max: 12, step: 1, default: 3 }),
    columns: columnsField(1, 2, 3),
    showExcerpt: f.toggle({ label: "Show excerpt", default: true, group: "style" }),
    showDate: f.toggle({ label: "Show date", default: true, group: "style" }),
  },
  render: ({ header: h, limit, columns, showExcerpt, showDate }, ctx) => {
    const data = ctx.metadata.data?.[ctx.id] as PostCard[] | undefined;
    const posts: PostCard[] =
      data ??
      (ctx.isEditing || ctx.metadata.blueprint
        ? Array.from({ length: limit }, (_, i) => ({ title: `Article ${i + 1}`, href: "#", excerpt: "A short excerpt of the article.", date: "" }))
        : []);
    return (
      <>
        <SectionHeader value={h} ctx={ctx} />
        <div className="qb-grid" style={{ ...colsStyle(columns, "lg"), "--qb-media-aspect": "16/9" } as CSSProperties}>
          {posts.slice(0, limit).map((p, i) => (
            <article key={i} className={cx("qb-card")} data-look="plain" data-linked>
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="qb-card-media" src={p.image.src} alt={p.image.alt} loading="lazy" />
              ) : (
                <span className="qb-media-placeholder" aria-hidden="true" />
              )}
              <div className="qb-card-body" style={{ padding: `${gap("sm")} 0` }}>
                {showDate && p.date ? <p className="qb-muted qb-small">{p.date}</p> : null}
                <h3 className="qb-heading qb-font-heading" style={{ fontSize: "var(--qb-step-1)" }}>
                  {p.title}
                </h3>
                {showExcerpt && p.excerpt ? <p className="qb-muted">{p.excerpt}</p> : null}
              </div>
              {!ctx.isEditing ? <a className="qb-card-link" href={p.href} aria-label={p.title} /> : null}
            </article>
          ))}
        </div>
      </>
    );
  },
});

export const formSections = [Newsletter, ContactForm, MapSection];
export const siteSections = [AnnouncementBar];
export const dataSections = [ProductGrid, PostList];
