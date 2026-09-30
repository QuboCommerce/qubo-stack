import type { CSSProperties, ReactNode } from "react";
import { defineBlock, f, linkTarget, resolveLink, resolveMedia, textOf } from "../core";
import { IconGlyph, iconNames } from "./icons";
import { alignOptions, aspectOptions, cx, Empty, gap, radiusOptions, Richtext, textAlign, typeSize } from "./shared";

const align = () => f.select(alignOptions, { label: "Alignment", default: "inherit", group: "layout" });

export const Eyebrow = defineBlock({
  name: "Eyebrow",
  label: "Eyebrow",
  description: "Short kicker text above a heading, optionally as a pill with an icon.",
  category: "elements",
  icon: "tag",
  fields: {
    text: f.text({ label: "Text", default: "New season", maxLength: 80 }),
    icon: f.icon({ label: "Icon" }),
    look: f.select(["text", "pill"], { label: "Look", default: "text", group: "style" }),
    align: align(),
  },
  render: ({ text, icon, look, align: a }) => (
    <p className="pk-eyebrow pk-font-accent" data-look={look} style={{ textAlign: textAlign(a) }}>
      <span>
        {icon ? <IconGlyph name={icon} size="1em" /> : null}
        {text}
      </span>
    </p>
  ),
});

const levelDefaults: Record<string, number> = { h1: 5, h2: 4, h3: 3, h4: 2, p: 1 };

function highlightWords(text: ReactNode, highlight: string): ReactNode {
  if (!highlight.trim()) return text;
  // In the editor `text` is Puck's inline-edit element; highlighted headings
  // trade inline editing for an exact preview (edit them in the panel).
  const raw = textOf(text);
  const i = raw.toLowerCase().indexOf(highlight.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {raw.slice(0, i)}
      <span className="pk-accent-text">{raw.slice(i, i + highlight.length)}</span>
      {raw.slice(i + highlight.length)}
    </>
  );
}

export const Heading = defineBlock({
  name: "Heading",
  label: "Heading",
  description: "A title. Level sets semantics (SEO); size and font come from the theme scale.",
  category: "elements",
  icon: "heading",
  fields: {
    text: f.text({ label: "Text", default: "A clear, confident headline", multiline: true }),
    highlight: f.text({
      label: "Highlight words",
      description: "Words inside the heading painted in the accent color.",
      translatable: true,
      inline: false,
    }),
    level: f.select(["h1", "h2", "h3", "h4", "p"], { label: "Level", default: "h2", group: "style" }),
    size: f.select(["auto", "1", "2", "3", "4", "5", "6"], { label: "Size", default: "auto", group: "style" }),
    font: f.select(["heading", "display", "accent", "body"], { label: "Font", default: "heading", group: "style" }),
    align: align(),
    balance: f.toggle({ label: "Balance lines", default: true, group: "advanced" }),
  },
  render: ({ text, highlight, level, size, font, align: a, balance }) => {
    const Tag = level as "h1";
    const step = size === "auto" ? levelDefaults[level]! : Number(size);
    return (
      <Tag
        className={cx("pk-heading", `pk-font-${font}`)}
        style={{ fontSize: typeSize(step), textAlign: textAlign(a), textWrap: balance ? "balance" : "wrap" }}
      >
        {highlightWords(text, highlight)}
      </Tag>
    );
  },
});

export const Text = defineBlock({
  name: "Text",
  label: "Text",
  description: "Rich text paragraph(s) with links, lists and emphasis.",
  category: "elements",
  icon: "text",
  fields: {
    body: f.richtext({ label: "Text", default: "<p>Tell your story in a sentence or two. Keep it short and specific.</p>" }),
    size: f.select(
      [
        { value: "-1", label: "Small" },
        { value: "0", label: "Body" },
        { value: "1", label: "Lead" },
        { value: "2", label: "Large" },
      ],
      { label: "Size", default: "0", group: "style" },
    ),
    tone: f.select(["default", "muted"], { label: "Tone", default: "default", group: "style" }),
    align: align(),
    measure: f.select(["prose", "full"], { label: "Line length", default: "prose", group: "layout" }),
  },
  render: ({ body, size, tone, align: a, measure }) => (
    <Richtext
      value={body}
      className={cx(tone === "muted" && "pk-muted")}
      style={{
        fontSize: typeSize(size),
        textAlign: textAlign(a),
        maxWidth: measure === "full" ? "none" : undefined,
        marginInline: a === "center" && measure === "prose" ? "auto" : undefined,
      }}
    />
  ),
});

export const Button = defineBlock({
  name: "Button",
  label: "Button",
  description: "Call-to-action link styled by the theme's button styles and the section's color scheme.",
  category: "elements",
  icon: "mouse-pointer-click",
  fields: {
    label: f.text({ label: "Label", default: "Get started", maxLength: 60 }),
    link: f.link({ label: "Link", default: { kind: "page", value: "contact" } }),
    emphasis: f.emphasis({ label: "Emphasis", default: "primary" }),
    buttonStyle: f.buttonStyle({ label: "Button style" }),
    icon: f.icon({ label: "Icon" }),
    iconPosition: f.select(["end", "start"], { label: "Icon position", default: "end", group: "style" }),
    size: f.select(["sm", "md", "lg"], { label: "Size", default: "md", group: "style" }),
    fullWidth: f.toggle({ label: "Full width", group: "layout" }),
  },
  render: ({ label, link, emphasis, buttonStyle, icon, iconPosition, size, fullWidth }, ctx) => {
    const href = resolveLink(link, ctx.metadata);
    const glyph = icon ? <IconGlyph name={icon} size="1.1em" /> : null;
    return (
      <a
        className="pk-button"
        href={ctx.isEditing ? undefined : href}
        data-emphasis={emphasis}
        data-button-style={buttonStyle || undefined}
        data-size={size}
        style={fullWidth ? { width: "100%" } : undefined}
        {...linkTarget(link)}
      >
        {iconPosition === "start" ? glyph : null}
        <span>{label}</span>
        {iconPosition === "end" ? glyph : null}
      </a>
    );
  },
});

export const ButtonGroup = defineBlock({
  name: "ButtonGroup",
  label: "Button group",
  description: "A row of buttons that wraps on small screens.",
  category: "elements",
  icon: "rectangle-ellipsis",
  fields: {
    buttons: f.slot({
      label: "Buttons",
      allow: ["Button"],
      default: [
        { type: "Button", props: { label: "Get started", emphasis: "primary" } },
        { type: "Button", props: { label: "Learn more", emphasis: "outline", link: { kind: "anchor", value: "details" } } },
      ],
    }),
    align: f.select(["start", "center", "end"], { label: "Alignment", default: "start", group: "layout" }),
    gap: f.step("space", { label: "Gap", default: "xs", max: "lg" }),
    stackOnMobile: f.toggle({ label: "Stack on mobile", group: "layout" }),
  },
  render: ({ buttons: Buttons, align: a, gap: g, stackOnMobile }) => (
    <Buttons
      className={cx("pk-button-group", stackOnMobile && "pk-stack-mobile")}
      style={{ justifyContent: a === "start" ? "flex-start" : a === "end" ? "flex-end" : "center", gap: gap(g) }}
    />
  ),
});

export const Image = defineBlock({
  name: "Image",
  label: "Image",
  description: "Picture from the media library with ratio, corner radius, caption and optional link.",
  category: "elements",
  icon: "image",
  fields: {
    image: f.media({ label: "Image" }),
    aspect: f.select(aspectOptions.map((o) => o), { label: "Aspect ratio", default: "auto", group: "style" }),
    fit: f.select(["cover", "contain"], { label: "Fit", default: "cover", group: "style" }),
    radius: f.select(radiusOptions, { label: "Corners", default: "lg", group: "style" }),
    caption: f.text({ label: "Caption" }),
    link: f.link({ label: "Link", default: { kind: "url", value: "" } }),
    priority: f.toggle({ label: "Load first (above the fold)", group: "advanced" }),
  },
  render: ({ image, aspect, fit, radius, caption, link, priority }, ctx) => {
    const media = resolveMedia(image, ctx.metadata);
    if (!media) return <Empty label="Choose an image" ctx={ctx} minHeight={180} />;
    const img = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="pk-image"
        src={media.src}
        alt={media.alt}
        width={media.width}
        height={media.height}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        style={{
          aspectRatio: aspect === "auto" ? undefined : aspect,
          objectFit: fit,
          objectPosition: media.objectPosition,
          borderRadius: `var(--pk-radius-${radius})`,
        }}
      />
    );
    const href = resolveLink(link, ctx.metadata);
    return (
      <figure className="pk-figure">
        {href && !ctx.isEditing ? (
          <a href={href} {...linkTarget(link)}>
            {img}
          </a>
        ) : (
          img
        )}
        {caption ? <figcaption className="pk-muted">{caption}</figcaption> : null}
      </figure>
    );
  },
});

export const Video = defineBlock({
  name: "Video",
  label: "Video",
  description: "Self-hosted video file with poster; autoplays muted as a loop or shows controls.",
  category: "elements",
  icon: "video",
  fields: {
    video: f.media({ label: "Video", accept: "video", translatableAlt: false }),
    mobileVideo: f.media({ label: "Mobile video (optional)", accept: "video", translatableAlt: false }),
    poster: f.media({ label: "Poster image", translatableAlt: false }),
    mode: f.select(["ambient", "player"], { label: "Mode", default: "ambient", description: "Ambient = muted autoplay loop; player = controls." }),
    aspect: f.select(aspectOptions.map((o) => o), { label: "Aspect ratio", default: "16/9", group: "style" }),
    radius: f.select(radiusOptions, { label: "Corners", default: "lg", group: "style" }),
  },
  render: ({ video, mobileVideo, poster, mode, aspect, radius }, ctx) => {
    const src = resolveMedia(video, ctx.metadata);
    if (!src) return <Empty label="Choose a video" ctx={ctx} minHeight={180} />;
    const mobile = resolveMedia(mobileVideo, ctx.metadata);
    const posterSrc = resolveMedia(poster, ctx.metadata)?.src;
    const ambient = mode === "ambient";
    return (
      <video
        className="pk-video"
        poster={posterSrc}
        autoPlay={ambient}
        muted={ambient}
        loop={ambient}
        playsInline
        controls={!ambient}
        preload={ambient ? "auto" : "metadata"}
        style={{ aspectRatio: aspect === "auto" ? undefined : aspect, borderRadius: `var(--pk-radius-${radius})` }}
      >
        {mobile ? <source src={mobile.src} media="(max-width: 767px)" /> : null}
        <source src={src.src} />
      </video>
    );
  },
});

export const Icon = defineBlock({
  name: "Icon",
  label: "Icon",
  description: "A single icon, optionally in a tinted circle.",
  category: "elements",
  icon: "smile",
  fields: {
    icon: f.icon({ label: "Icon", default: "snowflake" }),
    size: f.select(["sm", "md", "lg", "xl"], { label: "Size", default: "md", group: "style" }),
    tone: f.select(["text", "primary", "accent", "muted"], { label: "Color", default: "primary", group: "style" }),
    framed: f.toggle({ label: "Framed", default: true, group: "style" }),
  },
  render: ({ icon, size, tone, framed }) => (
    <span className="pk-icon" data-size={size} data-tone={tone} data-framed={framed || undefined}>
      <IconGlyph name={icon} size="1em" />
    </span>
  ),
});

export const Badge = defineBlock({
  name: "Badge",
  label: "Badge",
  description: "Small label: 'New', 'Best seller', 'Certified'.",
  category: "elements",
  icon: "badge",
  fields: {
    text: f.text({ label: "Text", default: "New", maxLength: 40 }),
    tone: f.select(["primary", "accent", "neutral", "outline"], { label: "Tone", default: "accent", group: "style" }),
  },
  render: ({ text, tone }) => (
    <span className="pk-badge pk-font-accent" data-tone={tone}>
      {text}
    </span>
  ),
});

export const Stat = defineBlock({
  name: "Stat",
  label: "Stat",
  description: "A big number with a label: '15+ years', '2,400 installs'.",
  category: "elements",
  icon: "trending-up",
  fields: {
    value: f.text({ label: "Value", default: "15+", maxLength: 16 }),
    label: f.text({ label: "Label", default: "Years of experience" }),
    align: align(),
  },
  render: ({ value, label, align: a }) => (
    <div className="pk-stat" style={{ textAlign: textAlign(a) }}>
      <div className="pk-stat-value pk-font-display">{value}</div>
      <div className="pk-muted">{label}</div>
    </div>
  ),
});

export const List = defineBlock({
  name: "List",
  label: "List",
  description: "Bullet, numbered, check or icon list.",
  category: "elements",
  icon: "list",
  fields: {
    items: f.list(
      {
        text: f.text({ label: "Text", default: "Benefit" }),
        icon: f.icon({ label: "Icon (icon lists)" }),
      },
      {
        label: "Items",
        summary: "text",
        itemLabel: "Item",
        default: [{ text: "Free on-site assessment", icon: "" }, { text: "Certified technicians", icon: "" }, { text: "24/7 emergency service", icon: "" }],
      },
    ),
    marker: f.select(["check", "bullet", "number", "icon"], { label: "Marker", default: "check", group: "style" }),
    gap: f.step("space", { label: "Gap", default: "2xs", max: "md" }),
  },
  render: ({ items, marker, gap: g }) => {
    const Tag = marker === "number" ? "ol" : "ul";
    return (
      <Tag className="pk-list" data-marker={marker} style={{ gap: gap(g) }}>
        {items.map((item, i) => (
          <li key={i}>
            {marker === "check" || (marker === "icon" && item.icon) ? (
              <IconGlyph className="pk-list-icon" name={marker === "check" ? "check" : item.icon} size="1.1em" />
            ) : null}
            <span>{item.text}</span>
          </li>
        ))}
      </Tag>
    );
  },
});

export const QuoteBlock = defineBlock({
  name: "Quote",
  label: "Quote",
  description: "Customer quote with author, role, avatar and optional star rating.",
  category: "elements",
  icon: "quote",
  fields: {
    quote: f.text({ label: "Quote", multiline: true, default: "They installed our cold room in two days. Zero downtime." }),
    author: f.text({ label: "Author", default: "Jamie L.", translatable: false }),
    role: f.text({ label: "Role / company", default: "Restaurant owner" }),
    avatar: f.media({ label: "Avatar" }),
    rating: f.number({ label: "Rating (0 = hidden)", min: 0, max: 5, step: 1, default: 5 }),
    size: f.select(["md", "lg"], { label: "Size", default: "md", group: "style" }),
  },
  render: ({ quote, author, role, avatar, rating, size }, ctx) => {
    const img = resolveMedia(avatar, ctx.metadata);
    return (
      <figure className="pk-quote" data-size={size}>
        {rating > 0 ? (
          <div className="pk-rating" aria-label={`${rating} out of 5`}>
            {Array.from({ length: 5 }, (_, i) => (
              <IconGlyph key={i} name="star" size="1em" fill={i < rating ? "currentColor" : "none"} />
            ))}
          </div>
        ) : null}
        <blockquote className="pk-quote-text">{quote}</blockquote>
        <figcaption className="pk-quote-author">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img.src} alt={img.alt} className="pk-avatar" />
          ) : null}
          <span>
            <strong>{author}</strong>
            {role ? <span className="pk-muted"> · {role}</span> : null}
          </span>
        </figcaption>
      </figure>
    );
  },
});

/** Only these hosts may be embedded; anything else renders nothing. */
export const embedProviders: { name: string; match: RegExp; toSrc: (url: URL) => string | null }[] = [
  {
    name: "YouTube",
    match: /(^|\.)youtube\.com$|(^|\.)youtu\.be$/,
    toSrc: (u) => {
      const id = u.hostname.includes("youtu.be") ? u.pathname.slice(1) : u.searchParams.get("v") ?? u.pathname.split("/").pop();
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    },
  },
  { name: "Vimeo", match: /(^|\.)vimeo\.com$/, toSrc: (u) => `https://player.vimeo.com/video/${u.pathname.split("/").filter(Boolean).pop()}` },
  { name: "Google Maps", match: /(^|\.)google\.[a-z.]+$/, toSrc: (u) => (u.pathname.startsWith("/maps") ? u.toString() : null) },
  { name: "Spotify", match: /(^|\.)spotify\.com$/, toSrc: (u) => `https://open.spotify.com/embed${u.pathname.replace(/^\/embed/, "")}` },
  { name: "Calendly", match: /(^|\.)calendly\.com$/, toSrc: (u) => u.toString() },
  { name: "Typeform", match: /(^|\.)typeform\.com$/, toSrc: (u) => u.toString() },
  { name: "Salonized", match: /(^|\.)salonized\.com$/, toSrc: (u) => u.toString() },
];

export function embedSrc(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    const provider = embedProviders.find((p) => p.match.test(url.hostname));
    return provider ? provider.toSrc(url) : null;
  } catch {
    return null;
  }
}

export const Embed = defineBlock({
  name: "Embed",
  label: "Embed",
  description: "YouTube, Vimeo, Google Maps, Spotify, Calendly, Typeform or Salonized embed (allow-listed).",
  category: "elements",
  icon: "code",
  fields: {
    url: f.text({ label: "URL", translatable: false, placeholder: "https://www.youtube.com/watch?v=…" }),
    title: f.text({ label: "Accessible title", default: "Embedded content" }),
    aspect: f.select(aspectOptions.filter((o) => o.value !== "auto").map((o) => o), { label: "Aspect ratio", default: "16/9", group: "style" }),
    radius: f.select(radiusOptions, { label: "Corners", default: "lg", group: "style" }),
  },
  render: ({ url, title, aspect, radius }, ctx) => {
    const src = embedSrc(url);
    if (!src) return <Empty label={url ? "This provider isn't allowed" : "Paste a video, map or booking URL"} ctx={ctx} minHeight={180} />;
    return (
      <iframe
        className="pk-embed"
        src={src}
        title={title}
        loading="lazy"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        style={{ aspectRatio: aspect, borderRadius: `var(--pk-radius-${radius})` }}
      />
    );
  },
});

export const Card = defineBlock({
  name: "Card",
  label: "Card",
  description: "Surface with optional image on top and free content inside; whole card can link.",
  category: "elements",
  icon: "square",
  fields: {
    image: f.media({ label: "Image" }),
    aspect: f.select(aspectOptions.map((o) => o), { label: "Image ratio", default: "4/3", group: "style" }),
    content: f.slot({
      label: "Content",
      default: [
        { type: "Heading", props: { text: "Card title", level: "h3", size: "2" } },
        { type: "Text", props: { body: "<p>A short supporting sentence.</p>", tone: "muted" } },
      ],
    }),
    link: f.link({ label: "Card link", default: { kind: "url", value: "" } }),
    look: f.select(["surface", "outline", "plain"], { label: "Look", default: "surface", group: "style" }),
    padding: f.step("space", { label: "Padding", default: "md", max: "xl" }),
  },
  render: ({ image, aspect, content: Content, link, look, padding }, ctx) => {
    const img = resolveMedia(image, ctx.metadata);
    const href = resolveLink(link, ctx.metadata);
    return (
      <article className="pk-card" data-look={look} data-linked={href ? true : undefined}>
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="pk-card-media"
            src={img.src}
            alt={img.alt}
            loading="lazy"
            style={{ aspectRatio: aspect === "auto" ? undefined : aspect, objectPosition: img.objectPosition }}
          />
        ) : null}
        <Content className="pk-card-body" style={{ padding: look === "plain" ? `${gap("sm")} 0` : gap(padding) } as CSSProperties} />
        {href && !ctx.isEditing ? <a className="pk-card-link" href={href} aria-label="Open" {...linkTarget(link)} /> : null}
      </article>
    );
  },
});

export const Price = defineBlock({
  name: "Price",
  label: "Price",
  description: "Formatted price with optional compare-at (strike-through) and suffix like '/ month'.",
  category: "elements",
  icon: "euro",
  fields: {
    amount: f.number({ label: "Amount", min: 0, step: 0.01, default: 49 }),
    compareAt: f.number({ label: "Compare-at amount (0 = none)", min: 0, step: 0.01, default: 0 }),
    currency: f.select(["EUR", "USD", "GBP", "MAD"], { label: "Currency", default: "EUR", group: "advanced" }),
    prefix: f.text({ label: "Prefix", placeholder: "From" }),
    suffix: f.text({ label: "Suffix", placeholder: "/ month" }),
    size: f.select(["sm", "md", "lg"], { label: "Size", default: "md", group: "style" }),
  },
  render: ({ amount, compareAt, currency, prefix, suffix, size }, ctx) => {
    const fmt = new Intl.NumberFormat(ctx.metadata.locale ?? "en", {
      style: "currency",
      currency,
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    });
    return (
      <p className="pk-price" data-size={size}>
        {prefix ? <span className="pk-muted">{prefix} </span> : null}
        <strong className="pk-font-display">{fmt.format(amount)}</strong>
        {compareAt > amount ? <s className="pk-muted">{fmt.format(compareAt)}</s> : null}
        {suffix ? <span className="pk-muted"> {suffix}</span> : null}
      </p>
    );
  },
});

export const Logo = defineBlock({
  name: "Logo",
  label: "Logo",
  description: "Brand logo image (or the site name as text) linking home.",
  category: "elements",
  icon: "aperture",
  fields: {
    image: f.media({ label: "Logo", translatableAlt: false }),
    text: f.text({ label: "Text fallback", translatable: false }),
    height: f.select(["sm", "md", "lg", "xl"], { label: "Height", default: "md", group: "style" }),
    link: f.link({ label: "Link", default: { kind: "page", value: "home" } }),
  },
  render: ({ image, text, height, link }, ctx) => {
    const img = resolveMedia(image, ctx.metadata);
    const label = text || ctx.metadata.site?.name || "Logo";
    const inner = img ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={img.src} alt={img.alt || label} />
    ) : (
      <span className="pk-font-display">{label}</span>
    );
    const href = resolveLink(link, ctx.metadata);
    return (
      <a className="pk-logo" data-size={height} href={ctx.isEditing ? undefined : href}>
        {inner}
      </a>
    );
  },
});

export const Avatar = defineBlock({
  name: "Avatar",
  label: "Avatar",
  description: "Round portrait with name and caption, or initials when no photo.",
  category: "elements",
  icon: "circle-user",
  fields: {
    photo: f.media({ label: "Photo" }),
    name: f.text({ label: "Name", default: "Mostapha H.", translatable: false }),
    caption: f.text({ label: "Caption", default: "Founder" }),
    size: f.select(["sm", "md", "lg"], { label: "Size", default: "md", group: "style" }),
  },
  render: ({ photo, name, caption, size }, ctx) => {
    const img = resolveMedia(photo, ctx.metadata);
    const initials = name
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    return (
      <div className="pk-avatar-block" data-size={size}>
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="pk-avatar" src={img.src} alt={img.alt || name} />
        ) : (
          <span className="pk-avatar" aria-hidden="true">
            {initials}
          </span>
        )}
        <span>
          <strong>{name}</strong>
          {caption ? <span className="pk-muted" style={{ display: "block" }}>{caption}</span> : null}
        </span>
      </div>
    );
  },
});

export const elementBlocks = [
  Eyebrow,
  Heading,
  Text,
  Button,
  ButtonGroup,
  Image,
  Video,
  Icon,
  Badge,
  Stat,
  Price,
  List,
  Logo,
  Avatar,
  QuoteBlock,
  Embed,
  Card,
];
export { iconNames };
