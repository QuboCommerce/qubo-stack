import type { ReactNode } from "react";
import { defineSection, f, textOf, type BlockContext } from "../../../core";
import {
  A,
  action,
  Arrow,
  ArrowIcon,
  brandFields,
  Eyebrow,
  eyebrowFields,
  hasAction,
  headingField,
  Icon,
  Img,
  isVideoSrc,
  KIT,
  Marked,
  mediaSrc,
  PartnerField,
  partnersField,
  reveal,
  Wordmark,
  type Action,
} from "./shared";

const kitChrome = { spacingTop: "none", spacingBottom: "none", width: "full", entrance: "none" } as const;
const base = { category: "sections" as const, kit: "chapters" };

const Button = ({ a, ctx, variant = "metal", extra = "" }: { a: Action; ctx: BlockContext; variant?: "metal" | "light"; extra?: string }) =>
  hasAction(a) ? (
    <A className={`qb-ch-button qb-ch-button--${variant}${extra}`} link={a.link} ctx={ctx}>
      {a.label as ReactNode}
      <Arrow />
    </A>
  ) : null;

const TextLink = ({ a, ctx, light }: { a: Action; ctx: BlockContext; light?: boolean }) =>
  hasAction(a) ? (
    <A className={light ? "qb-ch-text-link qb-ch-text-link--light" : "qb-ch-text-link"} link={a.link} ctx={ctx}>
      {a.label as ReactNode}
      <Arrow />
    </A>
  ) : null;

const titleId = (id: string, part: string) => `${id || "ch"}-${part}`;

// ---------------------------------------------------------------- hero ---

export const ChapterHero = defineSection({
  ...base,
  name: "ChapterHero",
  label: "Chapters: hero",
  description: "Headline with an underlined signal, conditions and actions, beside a photo and film carousel with captions.",
  icon: "gallery-horizontal",
  keywords: ["hero", "carousel", "slideshow", "video", "chapters"],
  chrome: kitChrome,
  fields: {
    heading: headingField("Good equipment.\n*For a service\n[that runs.]*", "Headline"),
    intro: f.text({ label: "Intro", multiline: true, default: "One or two sentences that make the value obvious." }),
    conditionsLabel: f.text({ inline: false, label: "Conditions label (screen readers)", default: "New and second hand", group: "advanced" }),
    conditions: f.list({ icon: f.icon({ label: "Icon", default: "line-box-check" }), label: f.text({ label: "Label", default: "New" }) }, {
      label: "Conditions",
      summary: "label",
      itemLabel: "Condition",
      default: [{ icon: "line-box-check", label: "New" }, { icon: "line-cycle", label: "Second hand" }],
    }),
    primary: action("Browse the catalogue", "all", "collection"),
    secondary: action("Talk about my needs", "+32 2 000 00 00", "phone"),
    texture: f.select(
      [
        { value: "faint", label: "Faint" },
        { value: "visible", label: "Visible" },
        { value: "strong", label: "Strong" },
      ],
      {
        label: "Background texture",
        default: "visible",
        description: "How much of the theme's material texture shows behind the headline. The wash keeps its angle so the text stays readable.",
      },
    ),
    carousel: f.group(
      {
        label: f.text({ inline: false, label: "Carousel name (screen readers)", default: "A look at the range" }),
        place: f.text({ label: "Caption eyebrow", default: "Brand · City" }),
        slideLabel: f.text({ inline: false, label: "Slide position", default: "{n} of {total}", description: "{n} and {total} are replaced.", group: "advanced" }),
        dotsLabel: f.text({ inline: false, label: "Dots label (screen readers)", default: "Choose an image or film", group: "advanced" }),
        prevLabel: f.text({ inline: false, label: "Previous (screen readers)", default: "Previous", group: "advanced" }),
        nextLabel: f.text({ inline: false, label: "Next (screen readers)", default: "Next", group: "advanced" }),
      },
      { label: "Carousel", collapsed: true },
    ),
    slides: f.list(
      {
        media: f.media({ label: "Image or film", accept: "any" }),
        poster: f.media({ label: "Film poster", accept: "image", description: "Shown before a film plays." }),
        caption: f.text({ inline: false, label: "Caption", default: "What this shows" }),
        dotLabel: f.text({ inline: false, label: "Dot label (screen readers)", default: "Show this slide" }),
      },
      { label: "Slides", summary: "caption", itemLabel: "Slide", default: [{}, {}] },
    ),
  },
  render: ({ id, heading, intro, conditionsLabel, conditions, primary, secondary, texture, carousel, slides }, ctx) => {
    const tid = titleId(id, "title");
    const total = slides.length;
    const pad = (n: number) => String(n).padStart(2, "0");
    const position = (i: number) => textOf(carousel.slideLabel).replace("{n}", String(i + 1)).replace("{total}", String(total));
    return (
      <div {...KIT} className="qb-ch-hero-stage" data-ch-texture={texture}>
        <section className="qb-ch-hero qb-ch-shell" aria-labelledby={tid}>
          <div className="qb-ch-hero__copy" {...reveal("left")}>
            <h1 id={tid}>
              <Marked value={heading} phrase="qb-ch-hero__signal" />
            </h1>
            <p className="qb-ch-hero__intro">{intro}</p>
            {conditions.length ? (
              <div className="qb-ch-hero__availability" aria-label={textOf(conditionsLabel)}>
                {conditions.map((c, i) => (
                  <p key={i}>
                    <Icon name={c.icon} className="qb-ch-condition-icon" />
                    <span>{c.label}</span>
                  </p>
                ))}
              </div>
            ) : null}
            <div className="qb-ch-hero__actions">
              <Button a={primary} ctx={ctx} />
              <TextLink a={secondary} ctx={ctx} />
            </div>
          </div>
          <div className="qb-ch-hero__visual" {...reveal("scale", 1)}>
            <section
              className="qb-ch-hero-carousel"
              aria-roledescription="carousel"
              aria-label={textOf(carousel.label)}
              data-slide-label={textOf(carousel.slideLabel)}
            >
              <div className="qb-ch-hero-carousel__viewport">
                {slides.map((s, i) => {
                  const src = mediaSrc(s.media, ctx);
                  const video = src && isVideoSrc(src);
                  return (
                    <figure
                      key={i}
                      className={i === 0 ? "qb-ch-hero-slide qb-ch-is-active" : "qb-ch-hero-slide"}
                      data-caption={textOf(s.caption)}
                      aria-hidden={i !== 0}
                      aria-roledescription="slide"
                      aria-label={position(i)}
                    >
                      {video ? (
                        <video
                          className="qb-ch-hero-slide__video"
                          muted
                          playsInline
                          preload="metadata"
                          poster={mediaSrc(s.poster, ctx)}
                          aria-label={s.media?.alt || textOf(s.caption)}
                        >
                          <source src={src} type="video/mp4" />
                        </video>
                      ) : (
                        <Img media={s.media} ctx={ctx} eager={i === 0} size={[1600, 1000]} />
                      )}
                      <figcaption className="qb-ch-visually-hidden">{textOf(s.caption)}</figcaption>
                    </figure>
                  );
                })}
              </div>
              <div className="qb-ch-hero-carousel__veil" aria-hidden="true" />
              <div className="qb-ch-hero-carousel__meta">
                <div className="qb-ch-hero-carousel__caption">
                  <span className="qb-ch-hero-carousel__eyebrow">
                    <Icon name="line-pin" className="qb-ch-section-icon" /> {carousel.place}
                  </span>
                  <strong data-ch-carousel-title="">{textOf(slides[0]?.caption)}</strong>
                </div>
                <span className="qb-ch-hero-carousel__counter" data-ch-carousel-counter="" aria-live="off">
                  {pad(1)} <i>/</i> {pad(total)}
                </span>
              </div>
              <div className="qb-ch-hero-carousel__controls">
                <div className="qb-ch-hero-carousel__dots" role="group" aria-label={textOf(carousel.dotsLabel)}>
                  {slides.map((s, i) => {
                    const src = mediaSrc(s.media, ctx);
                    const video = src && isVideoSrc(src);
                    const cls = ["qb-ch-hero-dot", i === 0 ? "qb-ch-is-active" : "", video ? "qb-ch-is-video" : ""].filter(Boolean).join(" ");
                    return (
                      <button key={i} className={cls} type="button" aria-label={textOf(s.dotLabel)} aria-pressed={i === 0}>
                        {video ? <span className="qb-ch-hero-dot__progress" aria-hidden="true" /> : null}
                      </button>
                    );
                  })}
                </div>
                <div className="qb-ch-hero-carousel__arrows">
                  <button className="qb-ch-carousel-arrow" type="button" data-ch-carousel-prev="" aria-label={textOf(carousel.prevLabel)}>
                    <span aria-hidden="true">
                      <ArrowIcon dir="left" />
                    </span>
                  </button>
                  <button className="qb-ch-carousel-arrow" type="button" data-ch-carousel-next="" aria-label={textOf(carousel.nextLabel)}>
                    <span aria-hidden="true">
                      <ArrowIcon dir="right" />
                    </span>
                  </button>
                </div>
              </div>
              <span className="qb-ch-visually-hidden" data-ch-carousel-status="" aria-live="polite" aria-atomic="true" />
            </section>
            <span className="qb-ch-hero__edge-light" aria-hidden="true" />
          </div>
        </section>
      </div>
    );
  },
});

// ----------------------------------------------------------- proofline ---

export const ChapterProofline = defineSection({
  ...base,
  name: "ChapterProofline",
  label: "Chapters: proof line",
  description: "Three short facts in a ruled line under the hero.",
  icon: "list",
  keywords: ["facts", "proof", "stats", "chapters"],
  chrome: kitChrome,
  fields: {
    label: f.text({ inline: false, label: "Label (screen readers)", default: "Key facts", group: "advanced" }),
    items: f.list({ title: f.text({ label: "Fact", default: "A fact" }), text: f.text({ label: "Detail", default: "Why it matters" }) }, {
      label: "Facts",
      summary: "title",
      itemLabel: "Fact",
      default: [{}, {}, {}],
    }),
  },
  render: ({ label, items }) => (
    <section {...KIT} className="qb-ch-proofline qb-ch-shell" aria-label={textOf(label)} {...reveal("rise")}>
      {items.map((it, i) => (
        <p key={i}>
          <strong>{it.title}</strong>
          <span>{it.text}</span>
        </p>
      ))}
    </section>
  ),
});

// ------------------------------------------------------------ pressure ---

export const ChapterPressure = defineSection({
  ...base,
  name: "ChapterPressure",
  label: "Chapters: constraints",
  description: "A narrative heading beside a ledger of the problems the visitor faces, with a bridge to the answer.",
  icon: "list-checks",
  keywords: ["problems", "pain points", "ledger", "narrative", "chapters"],
  chrome: kitChrome,
  fields: {
    ...eyebrowFields("On the ground", "line-worktable"),
    heading: headingField("When equipment\n*slows the service.*"),
    copy: f.text({ label: "Copy", multiline: true, default: "Why getting this right matters." }),
    items: f.list(
      {
        icon: f.icon({ label: "Icon", default: "line-worktable" }),
        title: f.text({ label: "Title", default: "A constraint." }),
        text: f.text({ label: "Text", multiline: true, default: "What it costs and how to think about it." }),
      },
      { label: "Ledger", summary: "title", itemLabel: "Entry", default: [{}, {}, {}] },
    ),
    bridgeLead: f.text({ label: "Bridge, lead", default: "Where to start?" }),
    bridgeText: f.text({ label: "Bridge, text", default: "Your space, your pace, your budget." }),
    bridgeLink: action("Find my range", "rayons", "anchor"),
  },
  render: ({ id, eyebrow, eyebrowIcon, heading, copy, items, bridgeLead, bridgeText, bridgeLink }, ctx) => {
    const tid = titleId(id, "title");
    return (
      <section {...KIT} className="qb-ch-pressure-section" aria-labelledby={tid}>
        <div className="qb-ch-shell qb-ch-pressure-section__inner">
          <div className="qb-ch-pressure-section__intro" {...reveal("left")}>
            <Eyebrow icon={eyebrowIcon} text={eyebrow} />
            <h2 className="qb-ch-narrative-heading" id={tid}>
              <Marked value={heading} />
            </h2>
            <p className="qb-ch-narrative-copy">{copy}</p>
          </div>
          <div className="qb-ch-pressure-ledger" {...reveal("right", 1)}>
            {items.map((it, i) => (
              <article key={i} className="qb-ch-pressure-ledger__item">
                <Icon name={it.icon} className="qb-ch-pressure-ledger__icon" />
                <div>
                  <h3>{it.title}</h3>
                  <p>{it.text}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="qb-ch-pressure-section__bridge" {...reveal("rise")}>
            <p>
              <strong>{bridgeLead}</strong> {bridgeText}
            </p>
            <TextLink a={bridgeLink} ctx={ctx} />
          </div>
        </div>
      </section>
    );
  },
});

// ----------------------------------------------------------- catalogue ---

const cardReveals = [reveal("scale"), reveal("rise", 1), reveal("wipe", 2), reveal("right", 3)];

export const ChapterCatalogue = defineSection({
  ...base,
  name: "ChapterCatalogue",
  label: "Chapters: catalogue",
  description: "Split heading, four large photo cards into the main families, and a drifting band of partner logos.",
  icon: "layout-grid",
  keywords: ["categories", "collections", "cards", "partners", "brands", "chapters"],
  chrome: { ...kitChrome, anchorId: "rayons" },
  fields: {
    ...eyebrowFields("The catalogue", "line-catalogue"),
    heading: headingField("Find your\n*fit*"),
    aside: f.text({ label: "Aside", multiline: true, default: "Start from what you need to do, then compare." }),
    cards: f.list(
      {
        media: f.media({ label: "Photo", accept: "image" }),
        title: f.text({ label: "Title", default: "Family" }),
        text: f.text({ label: "Text", default: "What you find here." }),
        link: f.link({ label: "Link", default: { kind: "collection", value: "all" } }),
        tone: f.select(
          [
            { value: "cold", label: "Cold" },
            { value: "cooking", label: "Cooking" },
            { value: "prep", label: "Preparation" },
            { value: "used", label: "Second hand" },
          ],
          { label: "Tint", default: "cold" },
        ),
      },
      { label: "Cards", summary: "title", itemLabel: "Card", max: 4, default: [{ tone: "cold" }, { tone: "cooking" }, { tone: "prep" }, { tone: "used" }] },
    ),
    partnersLabel: f.text({ label: "Partners label", default: "Our partners" }),
    partners: partnersField(),
  },
  render: ({ id, eyebrow, eyebrowIcon, heading, aside, cards, partnersLabel, partners }, ctx) => {
    const tid = titleId(id, "title");
    return (
      <section {...KIT} className="qb-ch-section qb-ch-section--catalogue" aria-labelledby={tid}>
        <div className="qb-ch-shell">
          <div className="qb-ch-section-heading qb-ch-section-heading--split" {...reveal("wipe")}>
            <div>
              <Eyebrow icon={eyebrowIcon} text={eyebrow} />
              <h2 id={tid}>
                <Marked value={heading} />
              </h2>
            </div>
            <p className="qb-ch-section-heading__aside">{aside}</p>
          </div>
          <div className="qb-ch-category-grid">
            {cards.map((c, i) => (
              <A key={i} className={`qb-ch-category-card qb-ch-category-card--${c.tone}`} link={c.link} ctx={ctx} {...cardReveals[i % 4]}>
                <Img media={c.media} ctx={ctx} size={[800, 600]} />
                <span className="qb-ch-category-card__body">
                  <span>
                    <strong>{c.title}</strong>
                    <small>{c.text}</small>
                  </span>
                  <span className="qb-ch-card-arrow" aria-hidden="true">
                    <ArrowIcon />
                  </span>
                </span>
              </A>
            ))}
          </div>
          {partners.length ? (
            <div className="qb-ch-partner-band">
              <PartnerField partners={partners} ctx={ctx} variant="inline" label={textOf(partnersLabel)} duration={84000} hoverRate={0.3} />
              <p className="qb-ch-partner-band__label">
                <Icon name="line-chain-link" className="qb-ch-section-icon" /> {partnersLabel}
              </p>
            </div>
          ) : null}
        </div>
      </section>
    );
  },
});

// ---------------------------------------------------------------- used ---

export const ChapterUsed = defineSection({
  ...base,
  name: "ChapterUsed",
  label: "Chapters: second hand",
  description: "Dark chapter with a stamped photo: new or second hand, plus buy-back.",
  icon: "recycle",
  keywords: ["second hand", "used", "occasion", "buy back", "chapters"],
  chrome: { ...kitChrome, anchorId: "used" },
  fields: {
    media: f.media({ label: "Photo", accept: "image" }),
    stamp: f.group(
      {
        ...brandFields(),
        conditions: f.list({ icon: f.icon({ label: "Icon", default: "line-box-check" }), label: f.text({ label: "Label", default: "New" }) }, {
          label: "Conditions",
          summary: "label",
          itemLabel: "Condition",
          default: [{ icon: "line-box-check", label: "New" }, { icon: "line-cycle", label: "Second hand" }],
        }),
      },
      { label: "Stamp", collapsed: true },
    ),
    ...eyebrowFields("Another way", "line-cycle"),
    heading: headingField("Your budget counts.\n*So does your need.*"),
    body: f.text({ label: "Text", multiline: true, default: "New, second hand or end of line: compare by what you really need." }),
    primary: action("See second hand", "used", "page"),
    secondary: action("Sell my equipment", "buy-back", "page"),
    note: f.text({ label: "Note", default: "Stock changes. Check online or ask the team." }),
  },
  render: ({ id, media, stamp, eyebrow, eyebrowIcon, heading, body, primary, secondary, note }, ctx) => {
    const tid = titleId(id, "title");
    return (
      <section {...KIT} className="qb-ch-used-section" aria-labelledby={tid}>
        <div className="qb-ch-shell qb-ch-used-section__inner">
          <div className="qb-ch-used-section__image" {...reveal("left")}>
            <Img media={media} ctx={ctx} size={[900, 760]} />
            <div className="qb-ch-image-stamp">
              <div className="qb-ch-wordmark qb-ch-wordmark--stamp">
                <Wordmark brand={stamp} ctx={ctx} size={36} />
              </div>
              <strong className="qb-ch-image-stamp__conditions">
                {stamp.conditions.map((c, i) => (
                  <span key={i} style={{ display: "contents" }}>
                    {i ? <span className="qb-ch-image-stamp__separator" aria-hidden="true" /> : null}
                    <span className="qb-ch-image-stamp__row">
                      <Icon name={c.icon} className="qb-ch-condition-icon" />
                      <span>{c.label}</span>
                    </span>
                  </span>
                ))}
              </strong>
            </div>
          </div>
          <div className="qb-ch-used-section__copy" {...reveal("right", 1)}>
            <Eyebrow icon={eyebrowIcon} text={eyebrow} light />
            <h2 id={tid}>
              <Marked value={heading} />
            </h2>
            <p>{body}</p>
            <div className="qb-ch-used-section__actions">
              <Button a={primary} ctx={ctx} variant="light" />
              <TextLink a={secondary} ctx={ctx} light />
            </div>
            {textOf(note) ? <p className="qb-ch-used-section__note">{note}</p> : null}
          </div>
        </div>
      </section>
    );
  },
});

// -------------------------------------------------------------- trades ---

const tradeReveals = [reveal("right"), reveal("scale", 1), reveal("left", 2), reveal("right", 3)];

export const ChapterTrades = defineSection({
  ...base,
  name: "ChapterTrades",
  label: "Chapters: trades",
  description: "Split heading and a ruled list of trades, each a way into the catalogue.",
  icon: "chef-hat",
  keywords: ["trades", "professions", "audiences", "list", "chapters"],
  chrome: { ...kitChrome, anchorId: "trades" },
  fields: {
    ...eyebrowFields("By trade", "line-utensils"),
    heading: headingField("Every trade,\n*[its equipment.]*"),
    aside: f.text({ label: "Aside", multiline: true, default: "Start from your trade to find a first lead." }),
    items: f.list(
      {
        icon: f.icon({ label: "Icon", default: "line-cloche" }),
        title: f.text({ label: "Trade", default: "Trade" }),
        detail: f.text({ label: "Detail", default: "What they need" }),
        link: f.link({ label: "Link", default: { kind: "collection", value: "all" } }),
      },
      { label: "Trades", summary: "title", itemLabel: "Trade", default: [{}, {}, {}, {}] },
    ),
  },
  render: ({ id, eyebrow, eyebrowIcon, heading, aside, items }, ctx) => {
    const tid = titleId(id, "title");
    return (
      <section {...KIT} className="qb-ch-section qb-ch-trade-section" aria-labelledby={tid}>
        <div className="qb-ch-shell">
          <div className="qb-ch-section-heading qb-ch-section-heading--split" {...reveal("left")}>
            <div>
              <Eyebrow icon={eyebrowIcon} text={eyebrow} />
              <h2 id={tid}>
                <Marked value={heading} />
              </h2>
            </div>
            <p className="qb-ch-section-heading__aside">{aside}</p>
          </div>
          <div className="qb-ch-trade-list">
            {items.map((it, i) => (
              <A key={i} link={it.link} ctx={ctx} {...tradeReveals[i % 4]}>
                <Icon name={it.icon} className="qb-ch-trade-list__icon" />
                <strong>{it.title}</strong>
                <span className="qb-ch-trade-list__detail">{it.detail}</span>
                <span className="qb-ch-trade-list__arrow" aria-hidden="true">
                  <ArrowIcon />
                </span>
              </A>
            ))}
          </div>
        </div>
      </section>
    );
  },
});

// ------------------------------------------------------------ material ---

export const ChapterMaterial = defineSection({
  ...base,
  name: "ChapterMaterial",
  label: "Chapters: steel interlude",
  description: "A brushed steel band with a faint film of cold vapour and four ways into the stainless range.",
  icon: "layers",
  keywords: ["steel", "inox", "material", "texture", "interlude", "chapters"],
  chrome: { ...kitChrome, anchorId: "inox" },
  fields: {
    texture: f.media({ label: "Steel texture", accept: "image" }),
    vapour: f.media({ label: "Vapour film", accept: "video", description: "A faint loop over the steel. Hidden on phones." }),
    poster: f.media({ label: "Film poster", accept: "image" }),
    ...eyebrowFields("For the pace of the trade", "line-worktable"),
    heading: headingField("Prepare.\n*[Store.] [Make room.]*"),
    body: f.text({ label: "Text", multiline: true, default: "Worktables, sinks, shelves and trolleys around the way you work." }),
    button: action("Explore stainless", "all", "collection"),
    entriesLabel: f.text({ inline: false, label: "Entries label (screen readers)", default: "Stainless equipment", group: "advanced" }),
    entries: f.list(
      {
        icon: f.icon({ label: "Icon", default: "line-worktable" }),
        kicker: f.text({ label: "Verb", default: "Prepare" }),
        title: f.text({ label: "Title", default: "Tables" }),
        link: f.link({ label: "Link", default: { kind: "collection", value: "all" } }),
      },
      { label: "Entries", summary: "title", itemLabel: "Entry", default: [{}, {}, {}, {}] },
    ),
  },
  render: ({ id, texture, vapour, poster, eyebrow, eyebrowIcon, heading, body, button, entriesLabel, entries }, ctx) => {
    const tid = titleId(id, "title");
    const film = mediaSrc(vapour, ctx);
    return (
      <section {...KIT} className="qb-ch-material-interlude qb-ch-material-interlude--field" aria-labelledby={tid} data-ch-steel="">
        <div className="qb-ch-material-field__backdrop" aria-hidden="true">
          <Img media={texture} ctx={ctx} className="qb-ch-material-field__texture" decorative size={[1200, 900]} />
          <div className="qb-ch-material-shader" />
          {film ? (
            <video className="qb-ch-material-field__vapour" muted playsInline loop preload="none" poster={mediaSrc(poster, ctx)} data-ambient="">
              <source src={film} type="video/mp4" />
            </video>
          ) : null}
        </div>
        <div className="qb-ch-material-field__veil" aria-hidden="true" />
        <div className="qb-ch-shell qb-ch-material-interlude__inner">
          <div className="qb-ch-material-interlude__copy" {...reveal("left")}>
            <Eyebrow icon={eyebrowIcon} text={eyebrow} />
            <h2 id={tid}>
              <Marked value={heading} />
            </h2>
            <p>{body}</p>
            <Button a={button} ctx={ctx} />
          </div>
          <nav className="qb-ch-material-entries" aria-label={textOf(entriesLabel)} {...reveal("right")}>
            {entries.map((e, i) => (
              <A key={i} link={e.link} ctx={ctx}>
                <Icon name={e.icon} className="qb-ch-material-entry__icon" />
                <span>
                  <small>{e.kicker}</small>
                  <strong>{e.title}</strong>
                </span>
                <span className="qb-ch-material-entry__arrow" aria-hidden="true">
                  <ArrowIcon />
                </span>
              </A>
            ))}
          </nav>
        </div>
      </section>
    );
  },
});

// ------------------------------------------------------------- service ---

const serviceReveals = [reveal("right", 1), reveal("scale", 2)];

export const ChapterService = defineSection({
  ...base,
  name: "ChapterService",
  label: "Chapters: service ribbon",
  description: "Cobalt ribbon: what happens after the purchase, in two short promises.",
  icon: "truck",
  keywords: ["service", "delivery", "after sales", "support", "chapters"],
  chrome: kitChrome,
  fields: {
    label: f.text({ inline: false, label: "Label (screen readers)", default: "Services", group: "advanced" }),
    ...eyebrowFields("The service goes on", "line-wrench"),
    heading: headingField("After the choice,\n*[what follows counts.]*"),
    items: f.list(
      {
        icon: f.icon({ label: "Icon", default: "line-truck" }),
        title: f.text({ label: "Title", default: "Delivery" }),
        text: f.text({ label: "Text", multiline: true, default: "How it works." }),
      },
      { label: "Services", summary: "title", itemLabel: "Service", max: 2, default: [{ icon: "line-truck" }, { icon: "line-headset", title: "After sales" }] },
    ),
  },
  render: ({ label, eyebrow, eyebrowIcon, heading, items }) => (
    <section {...KIT} className="qb-ch-service-ribbon" aria-label={textOf(label)}>
      <div className="qb-ch-shell qb-ch-service-ribbon__inner">
        <div className="qb-ch-service-ribbon__intro" {...reveal("left")}>
          <Eyebrow icon={eyebrowIcon} text={eyebrow} light />
          <h2>
            <Marked value={heading} />
          </h2>
        </div>
        {items.map((it, i) => (
          <div key={i} className="qb-ch-service-detail" {...serviceReveals[i % 2]}>
            <Icon name={it.icon} className="qb-ch-service-detail__icon" />
            <div>
              <h3>{it.title}</h3>
              <p>{it.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  ),
});

// --------------------------------------------------------------- visit ---

export const ChapterVisit = defineSection({
  ...base,
  name: "ChapterVisit",
  label: "Chapters: showroom",
  description: "Invitation to the showroom with a steel card: address, opening hours and phone.",
  icon: "map-pin",
  keywords: ["showroom", "visit", "address", "hours", "location", "chapters"],
  chrome: { ...kitChrome, anchorId: "visit" },
  fields: {
    ...eyebrowFields("City · Region", "line-pin"),
    heading: headingField("See better.\n*Choose better.*"),
    body: f.text({ label: "Text", multiline: true, default: "Come and see the equipment and ask your questions." }),
    button: action("Directions", "https://www.google.com/maps", "url"),
    cardTitle: f.text({ label: "Card title", default: "Brand · Showroom" }),
    address: f.text({ label: "Address", multiline: true, inline: false, default: "Street 1\n1000 City" }),
    hours: f.list({ days: f.text({ label: "Days", default: "Monday – Friday" }), time: f.text({ label: "Hours", default: "9h – 18h" }) }, {
      label: "Opening hours",
      summary: "days",
      itemLabel: "Row",
      default: [{}],
    }),
    phone: f.text({ label: "Phone", default: "+32 2 000 00 00", translatable: false }),
  },
  render: ({ id, eyebrow, eyebrowIcon, heading, body, button, cardTitle, address, hours, phone }, ctx) => {
    const tid = titleId(id, "title");
    return (
      <section {...KIT} className="qb-ch-visit-section" aria-labelledby={tid}>
        <div className="qb-ch-shell qb-ch-visit-section__inner">
          <div className="qb-ch-visit-section__copy" {...reveal("left")}>
            <Eyebrow icon={eyebrowIcon} text={eyebrow} />
            <h2 id={tid}>
              <Marked value={heading} />
            </h2>
            <p>{body}</p>
            <Button a={button} ctx={ctx} />
          </div>
          <div className="qb-ch-visit-card" {...reveal("scale", 1)}>
            <div className="qb-ch-visit-card__top">
              <Icon name="line-pin" className="qb-ch-visit-card__pin" />
              <span>{cardTitle}</span>
            </div>
            <address>
              <Marked value={address} />
            </address>
            <div className="qb-ch-opening-hours">
              {hours.map((h, i) => (
                <p key={i}>
                  <span>{h.days}</span>
                  <strong>{h.time}</strong>
                </p>
              ))}
            </div>
            <A className="qb-ch-visit-card__phone" link={{ kind: "phone", value: textOf(phone) }} ctx={ctx}>
              {textOf(phone)}
              <Arrow />
            </A>
          </div>
        </div>
      </section>
    );
  },
});

// --------------------------------------------------------------- route ---

export const ChapterRoute = defineSection({
  ...base,
  name: "ChapterRoute",
  label: "Chapters: buyer route",
  description: "Three numbered steps from need to choice, each with a next action.",
  icon: "list-ordered",
  keywords: ["steps", "process", "how it works", "route", "chapters"],
  chrome: { ...kitChrome, anchorId: "how-to-choose" },
  fields: {
    ...eyebrowFields("From need to choice", "line-catalogue"),
    heading: headingField("And now?"),
    copy: f.text({ label: "Copy", multiline: true, default: "No need to know the exact reference yet." }),
    steps: f.list(
      {
        title: f.text({ label: "Title", default: "A step." }),
        text: f.text({ label: "Text", multiline: true, default: "What to do." }),
        action: action("Next", "rayons", "anchor"),
      },
      { label: "Steps", summary: "title", itemLabel: "Step", default: [{}, {}, {}] },
    ),
  },
  render: ({ id, eyebrow, eyebrowIcon, heading, copy, steps }, ctx) => {
    const tid = titleId(id, "title");
    return (
      <section {...KIT} className="qb-ch-buyer-route" aria-labelledby={tid}>
        <div className="qb-ch-shell">
          <div className="qb-ch-buyer-route__heading" {...reveal("rise")}>
            <div>
              <Eyebrow icon={eyebrowIcon} text={eyebrow} />
              <h2 className="qb-ch-narrative-heading" id={tid}>
                <Marked value={heading} />
              </h2>
            </div>
            <p className="qb-ch-narrative-copy">{copy}</p>
          </div>
          <ol className="qb-ch-buyer-route__steps" role="list">
            {steps.map((s, i) => (
              <li key={i} {...reveal("rise", i ? (Math.min(i, 3) as 1 | 2 | 3) : undefined)}>
                <span className="qb-ch-buyer-route__number" aria-hidden="true">
                  {i + 1}
                </span>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                  <TextLink a={s.action} ctx={ctx} />
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  },
});

// ----------------------------------------------------------------- faq ---

export const ChapterFaq = defineSection({
  ...base,
  name: "ChapterFaq",
  label: "Chapters: questions",
  description: "Practical questions in steel-ruled folds beside an intro and a call to action, with FAQ rich results.",
  icon: "circle-help",
  keywords: ["faq", "questions", "accordion", "chapters"],
  chrome: { ...kitChrome, anchorId: "questions" },
  fields: {
    ...eyebrowFields("Practical questions", "line-headset"),
    heading: headingField("Before\n*you decide.*"),
    copy: f.text({ label: "Copy", multiline: true, default: "What to clarify before choosing." }),
    button: action("Ask my question", "+32 2 000 00 00", "phone"),
    items: f.list(
      { question: f.text({ label: "Question", default: "A common question?" }), answer: f.text({ label: "Answer", multiline: true, default: "A clear answer." }) },
      { label: "Questions", summary: "question", itemLabel: "Question", default: [{}, {}, {}] },
    ),
    structuredData: f.toggle({ label: "FAQ rich results (SEO)", default: true, group: "advanced" }),
  },
  render: ({ id, eyebrow, eyebrowIcon, heading, copy, button, items, structuredData }, ctx) => {
    const tid = titleId(id, "title");
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
      <section {...KIT} className="qb-ch-buyer-faq" aria-labelledby={tid}>
        <div className="qb-ch-shell qb-ch-buyer-faq__inner">
          <div className="qb-ch-buyer-faq__intro" {...reveal("left")}>
            <Eyebrow icon={eyebrowIcon} text={eyebrow} />
            <h2 className="qb-ch-narrative-heading" id={tid}>
              <Marked value={heading} />
            </h2>
            <p className="qb-ch-narrative-copy">{copy}</p>
            <Button a={button} ctx={ctx} />
          </div>
          <div className="qb-ch-buyer-faq__list">
            {items.map((it, i) => (
              <details key={i} className="qb-ch-buyer-faq__item">
                <summary>
                  {it.question}
                  <span className="qb-ch-buyer-faq__toggle" aria-hidden="true" />
                </summary>
                <div className="qb-ch-buyer-faq__answer">
                  <p>{it.answer}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
        {jsonLd && !ctx.isEditing ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} /> : null}
      </section>
    );
  },
});

// ------------------------------------------------------------- contact ---

export const ChapterContact = defineSection({
  ...base,
  name: "ChapterContact",
  label: "Chapters: contact",
  description: "Closing chapter on graphite: a short invitation, a call button, the showroom and the phone in large type.",
  icon: "phone",
  keywords: ["contact", "call", "cta", "closing", "chapters"],
  chrome: { ...kitChrome, anchorId: "contact" },
  fields: {
    ...eyebrowFields("A specific need?", "line-phone"),
    heading: headingField("Grow\n*in hospitality*"),
    body: f.text({ label: "Text", multiline: true, default: "Tell us about your business and what you are missing." }),
    primary: action("Talk about my needs", "+32 2 000 00 00", "phone"),
    secondary: action("Or visit the showroom", "visit", "anchor"),
    phone: f.text({ label: "Phone", default: "+32 2 000 00 00", translatable: false }),
    hours: f.text({ label: "Hours", default: "Mon–Fri 9–18" }),
  },
  render: ({ id, eyebrow, eyebrowIcon, heading, body, primary, secondary, phone, hours }, ctx) => {
    const tid = titleId(id, "title");
    return (
      <section {...KIT} className="qb-ch-contact-section" aria-labelledby={tid}>
        <div className="qb-ch-shell qb-ch-contact-section__inner">
          <div {...reveal("left")}>
            <Eyebrow icon={eyebrowIcon} text={eyebrow} light />
            <h2 id={tid}>
              <Marked value={heading} />
            </h2>
          </div>
          <div className="qb-ch-contact-section__action" {...reveal("right", 1)}>
            <p>{body}</p>
            <div className="qb-ch-contact-section__choices">
              <Button a={primary} ctx={ctx} extra=" qb-ch-button--large" />
              <TextLink a={secondary} ctx={ctx} light />
            </div>
            <A className="qb-ch-contact-section__phone" link={{ kind: "phone", value: textOf(phone) }} ctx={ctx}>
              {textOf(phone)}
            </A>
            <span className="qb-ch-contact-section__hours">{hours}</span>
          </div>
        </div>
      </section>
    );
  },
});

// -------------------------------------------------------------- footer ---

export const ChapterFooter = defineSection({
  ...base,
  category: "site",
  name: "ChapterFooter",
  label: "Chapters: footer",
  description: "Wordmark, one line, quick links and a back-to-top line.",
  icon: "panel-bottom",
  keywords: ["footer", "chapters"],
  chrome: kitChrome,
  fields: {
    brand: f.group(brandFields(), { label: "Brand", collapsed: true }),
    home: f.link({ label: "Logo link", default: { kind: "page", value: "home" } }),
    blurb: f.text({ label: "Line", default: "Professional equipment for the people who run the service." }),
    links: f.list({ label: f.text({ label: "Label", default: "Link" }), link: f.link({ label: "Link" }) }, {
      label: "Links",
      summary: "label",
      itemLabel: "Link",
    }),
    legal: f.list({ label: f.text({ label: "Label", default: "Legal notice" }), link: f.link({ label: "Link" }) }, {
      label: "Legal links",
      summary: "label",
      itemLabel: "Link",
    }),
    copyright: f.text({ label: "Copyright", default: "© Brand" }),
    since: f.text({ label: "Since", default: "Since 2008" }),
    top: f.text({ label: "Back to top", default: "Back to top" }),
    topLink: f.link({ label: "Back to top link", default: { kind: "anchor", value: "top" } }),
  },
  render: ({ brand, home, blurb, links, legal, copyright, since, top, topLink }, ctx) => (
    <footer {...KIT} className="qb-ch-site-footer">
      <div className="qb-ch-shell qb-ch-site-footer__main">
        <A className="qb-ch-wordmark qb-ch-wordmark--footer" link={home} ctx={ctx} aria-label={textOf(brand.name)}>
          <Wordmark brand={brand} ctx={ctx} size={44} />
        </A>
        <p>{blurb}</p>
        <div className="qb-ch-site-footer__links">
          {links.map((l, i) => (
            <A key={i} link={l.link} ctx={ctx}>
              {l.label as ReactNode}
            </A>
          ))}
        </div>
      </div>
      <div className="qb-ch-shell qb-ch-site-footer__bottom">
        <span>{copyright}</span>
        {legal.length ? (
          <span className="qb-ch-site-footer__legal">
            {legal.map((l, i) => (
              <A key={i} link={l.link} ctx={ctx}>
                {l.label as ReactNode}
              </A>
            ))}
          </span>
        ) : null}
        <span>{since}</span>
        <A link={topLink} ctx={ctx} className="qb-ch-site-footer__top">
          {top}
          <ArrowIcon dir="up" />
        </A>
      </div>
    </footer>
  ),
});

export const chapterSections = [
  ChapterHero,
  ChapterProofline,
  ChapterPressure,
  ChapterCatalogue,
  ChapterUsed,
  ChapterTrades,
  ChapterMaterial,
  ChapterService,
  ChapterVisit,
  ChapterRoute,
  ChapterFaq,
  ChapterContact,
  ChapterFooter,
];
