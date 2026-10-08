import type { CSSProperties } from "react";
import { defineSection, f, linkTarget, localHref, resolveLink, resolveMedia, textOf, type BlockContext, type LinkValue } from "../../core";
import { IconGlyph } from "../icons";
import { CartCount } from "../cart";

const has = (ctx: BlockContext, capability: string) =>
  (ctx.metadata.site?.capabilities as string[] | undefined)?.includes(capability) ?? true;

function NavLink({ label, link, ctx, className }: { label: string; link: LinkValue; ctx: BlockContext; className?: string }) {
  const href = resolveLink(link, ctx.metadata);
  return (
    <a className={className} href={ctx.isEditing ? undefined : href} {...linkTarget(link)}>
      {label}
    </a>
  );
}

function Brand({ logo, name, ctx }: { logo: Parameters<typeof resolveMedia>[0]; name: string; ctx: BlockContext }) {
  const media = resolveMedia(logo, ctx.metadata);
  return (
    <a className="qb-site-brand" href={ctx.isEditing ? undefined : localHref("/", ctx.metadata)} aria-label={name}>
      {media ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.src} alt={media.alt || name} />
      ) : (
        <span>{name}</span>
      )}
    </a>
  );
}

const navItem = {
  label: f.text({ label: "Label", default: "Shop" }),
  link: f.link({ label: "Link", default: { kind: "collection", value: "all" } }),
  image: f.media({ label: "Feature image (mega menus)" }),
  children: f.list(
    {
      label: f.text({ label: "Label", default: "Link" }),
      link: f.link({ label: "Link" }),
      description: f.text({ label: "Short description (mega menus)", inline: false }),
    },
    { label: "Dropdown links", summary: "label", itemLabel: "Link", default: [] },
  ),
};

type NavItem = {
  label: string;
  link: LinkValue;
  image: Parameters<typeof resolveMedia>[0];
  children: { label: string; link: LinkValue; description: string }[];
};

export const headerPatterns = ["bar", "bar-mega", "sidebar", "sheet", "fullscreen"] as const;
export type HeaderPattern = (typeof headerPatterns)[number];
export type MenuPanelKind = "drop" | "sheet" | "fullscreen";

/** The menu panel kind used below the breakpoint (or always, for menu-button patterns). */
export const menuPanelKind = (pattern: HeaderPattern, menu: MenuPanelKind): MenuPanelKind =>
  pattern === "sheet" || pattern === "fullscreen" ? pattern : menu;

const menuIdOf = (id: string) => `qb-menu-${(id || "site").replace(/[^\w-]/g, "")}`;

function DesktopList({ links, mega, name, ctx }: { links: NavItem[]; mega: boolean; name: string; ctx: BlockContext }) {
  return (
    <ul className="qb-site-nav-list">
      {links.map((item, i) => {
        if (!item.children.length) {
          return (
            <li key={i} className="qb-site-nav-item">
              <NavLink label={item.label} link={item.link} ctx={ctx} />
            </li>
          );
        }
        const feature = mega ? resolveMedia(item.image, ctx.metadata) : null;
        return (
          <li key={i} className="qb-site-nav-item" data-mega={mega || undefined}>
            <details className="qb-site-dropdown" name={name}>
              <summary>
                {item.label} <IconGlyph name="chevron-down" size="0.9em" />
              </summary>
              {mega ? (
                <div className="qb-site-mega" data-feature={feature ? true : undefined}>
                  <ul>
                    {item.children.map((child, j) => (
                      <li key={j}>
                        <a href={ctx.isEditing ? undefined : resolveLink(child.link, ctx.metadata)} {...linkTarget(child.link)}>
                          <strong>{child.label}</strong>
                          {child.description ? <span>{child.description}</span> : null}
                        </a>
                      </li>
                    ))}
                  </ul>
                  <a className="qb-site-mega-all" href={ctx.isEditing ? undefined : resolveLink(item.link, ctx.metadata)} {...linkTarget(item.link)}>
                    {feature ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={feature.src} alt={feature.alt} style={{ objectPosition: feature.objectPosition }} />
                    ) : null}
                    <span>
                      {item.label} <IconGlyph name="arrow-right" size="1em" />
                    </span>
                  </a>
                </div>
              ) : (
                <ul>
                  <li>
                    <NavLink label={item.label} link={item.link} ctx={ctx} />
                  </li>
                  {item.children.map((child, j) => (
                    <li key={j}>
                      <NavLink label={child.label} link={child.link} ctx={ctx} />
                    </li>
                  ))}
                </ul>
              )}
            </details>
          </li>
        );
      })}
    </ul>
  );
}

function PanelList({ links, ctx }: { links: NavItem[]; ctx: BlockContext }) {
  return (
    <ul className="qb-site-panel-list">
      {links.map((item, i) => (
        <li key={i} style={{ "--i": i } as CSSProperties}>
          {item.children.length ? (
            <details>
              <summary>
                {item.label} <IconGlyph name="chevron-down" size="0.8em" />
              </summary>
              <ul>
                <li>
                  <NavLink label={item.label} link={item.link} ctx={ctx} />
                </li>
                {item.children.map((child, j) => (
                  <li key={j}>
                    <NavLink label={child.label} link={child.link} ctx={ctx} />
                  </li>
                ))}
              </ul>
            </details>
          ) : (
            <NavLink label={item.label} link={item.link} ctx={ctx} />
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Site-wide header (lives in the `header` section group). Five layouts share one
 * markup: inline links (`bar`, `bar-mega`), a vertical rail (`sidebar`) or a
 * menu button only (`sheet`, `fullscreen`). The menu panel is a native popover
 * opened by `popovertarget`, so it opens, closes and light-dismisses without
 * client JavaScript; enter and leave follow `theme.motion.nav` in CSS.
 */
export const SiteHeader = defineSection({
  name: "SiteHeader",
  label: "Site header",
  description: "Logo, main navigation as a bar, mega menu, sidebar, side sheet or fullscreen menu, and search, account and cart shortcuts.",
  category: "site",
  icon: "house",
  keywords: ["header", "navigation", "menu", "navbar", "logo", "mega menu", "sidebar", "drawer", "fullscreen"],
  chrome: { width: "wide", spacingTop: "xs", spacingBottom: "xs", entrance: "none" },
  fields: {
    logo: f.media({ label: "Logo" }),
    name: f.text({ label: "Site name (shown without a logo)", default: "My store", inline: false }),
    links: f.list(navItem, { label: "Navigation", summary: "label", itemLabel: "Menu item", default: [{}] }),
    pattern: f.select(
      [
        { value: "bar", label: "Bar with dropdowns" },
        { value: "bar-mega", label: "Bar with mega menus" },
        { value: "sidebar", label: "Sidebar" },
        { value: "sheet", label: "Menu button, side sheet" },
        { value: "fullscreen", label: "Menu button, fullscreen" },
      ],
      { label: "Layout", default: "bar", group: "layout", description: "How the navigation sits on large screens." },
    ),
    menu: f.select(
      [
        { value: "drop", label: "Drop down" },
        { value: "sheet", label: "Side sheet" },
        { value: "fullscreen", label: "Fullscreen" },
      ],
      { label: "Menu on small screens", default: "drop", group: "layout", description: "Used by the bar and sidebar layouts once the screen gets narrow." },
    ),
    side: f.select(["right", "left", "top", "bottom"], { label: "Comes in from", default: "right", group: "layout", description: "Side of the sheet, fullscreen slide and sidebar (left or right)." }),
    megaColumns: f.number({ label: "Mega menu columns", min: 1, max: 4, default: 3, group: "layout" }),
    stacked: f.toggle({
      label: "Navigation on its own row",
      default: false,
      group: "layout",
      description: "Bar layouts only. Logo, search and actions on top, the menu below. Fits long menus on laptops.",
    }),
    sticky: f.toggle({ label: "Stay at the top while scrolling", default: false, group: "layout" }),
    showSearch: f.toggle({ label: "Search", default: true }),
    searchPlaceholder: f.text({ label: "Search placeholder", default: "Search", inline: false }),
    showAccount: f.toggle({ label: "Account", default: true }),
    accountLabel: f.text({ label: "Account label (empty shows an icon only)", default: "", inline: false }),
    showCart: f.toggle({ label: "Cart", default: true }),
    languageSwitch: f.toggle({
      label: "Language switch",
      default: true,
      description: "Shows the site's published languages as links. Hidden while the site has one language.",
    }),
    ctaLabel: f.text({ label: "Button label" }),
    ctaLink: f.link({ label: "Button link" }),
  },
  render: (
    { logo, name, links, pattern, menu, side, megaColumns, stacked, sticky, showSearch, searchPlaceholder, showAccount, accountLabel, showCart, languageSwitch, ctaLabel, ctaLink },
    ctx,
  ) => {
    const locales = ctx.metadata.locales ?? [];
    const switcher =
      languageSwitch && locales.length > 1 ? (
        <nav className="qb-site-lang" aria-label="Language">
          {locales.map((l) => (
            <a key={l.locale} href={ctx.isEditing ? undefined : l.href} hrefLang={l.locale} lang={l.locale} aria-current={l.current ? "true" : undefined}>
              {l.label}
            </a>
          ))}
        </nav>
      ) : null;
    const siteName = textOf(name) || ctx.metadata.site?.name || "";
    const items = links as NavItem[];
    const inline = pattern === "bar" || pattern === "bar-mega" || pattern === "sidebar";
    const panel = menuPanelKind(pattern, menu);
    const menuId = menuIdOf(ctx.id);
    const nav = ctx.metadata.theme?.motion.nav;
    const commerce = has(ctx, "commerce");
    const searchLabel = textOf(searchPlaceholder) || "Search";
    const cta =
      ctaLabel && ctaLink?.value ? (
        <a className="qb-button qb-site-cta" data-emphasis="primary" data-size="sm" href={ctx.isEditing ? undefined : resolveLink(ctaLink, ctx.metadata)} {...linkTarget(ctaLink)}>
          <span>{ctaLabel}</span>
        </a>
      ) : null;
    return (
      <header
        className="qb-site-header"
        data-pattern={pattern}
        data-side={side}
        data-sticky={sticky || undefined}
        data-stacked={(stacked && (pattern === "bar" || pattern === "bar-mega")) || undefined}
        data-collapse={inline ? "auto" : "always"}
        style={{ "--qb-mega-cols": megaColumns } as CSSProperties}
      >
        <Brand logo={logo} name={siteName} ctx={ctx} />
        {inline ? (
          <nav className="qb-site-nav" aria-label="Main">
            <DesktopList links={items} mega={pattern === "bar-mega"} name={`${menuId}-dd`} ctx={ctx} />
          </nav>
        ) : null}
        <div className="qb-site-actions">
          {showSearch ? (
            <>
              <form className="qb-site-search" action={localHref("/search", ctx.metadata)} role="search">
                <IconGlyph name="search" size="1em" />
                <input type="search" name="q" placeholder={textOf(searchPlaceholder)} aria-label={searchLabel} />
              </form>
              <a className="qb-site-icon qb-site-search-icon" href={ctx.isEditing ? undefined : localHref("/search", ctx.metadata)} aria-label={searchLabel}>
                <IconGlyph name="search" size="1.25em" />
              </a>
            </>
          ) : null}
          {showAccount && has(ctx, "accounts") ? (
            textOf(accountLabel) ? (
              <a className="qb-button qb-site-account" data-emphasis="outline" data-size="sm" href={ctx.isEditing ? undefined : localHref("/account", ctx.metadata)}>
                <IconGlyph name="user" size="1.1em" />
                <span>{textOf(accountLabel)}</span>
              </a>
            ) : (
              <a className="qb-site-icon" href={ctx.isEditing ? undefined : localHref("/account", ctx.metadata)} aria-label="Account">
                <IconGlyph name="user" size="1.25em" />
              </a>
            )
          ) : null}
          {showCart && commerce ? (
            <a className="qb-site-icon" href={ctx.isEditing ? undefined : localHref("/cart", ctx.metadata)} aria-label="Cart">
              <IconGlyph name="shopping-bag" size="1.25em" />
              {ctx.metadata.site?.id && !ctx.isEditing ? <CartCount siteId={ctx.metadata.site.id} /> : null}
            </a>
          ) : null}
          {switcher}
          {cta}
          <button type="button" className="qb-site-icon qb-site-menu-toggle" popoverTarget={menuId} aria-label="Menu">
            <IconGlyph name="menu" size="1.4em" />
          </button>
        </div>
        <div
          id={menuId}
          popover="auto"
          className="qb-site-menu-panel"
          data-menu={panel}
          data-side={panel === "drop" ? "top" : side}
          data-enter={nav?.enter ?? "slide"}
          data-exit={nav?.exit ?? "fade"}
        >
          <div className="qb-site-menu-top">
            <Brand logo={logo} name={siteName} ctx={ctx} />
            <button type="button" className="qb-site-icon" popoverTarget={menuId} popoverTargetAction="hide" aria-label="Close menu">
              <IconGlyph name="x" size="1.4em" />
            </button>
          </div>
          <nav aria-label="Menu">
            <PanelList links={items} ctx={ctx} />
          </nav>
          {cta}
        </div>
      </header>
    );
  },
});

/** Site-wide footer (lives in the `footer` section group). */
export const SiteFooter = defineSection({
  name: "SiteFooter",
  label: "Site footer",
  description: "Brand blurb, link columns, contact details and the legal line.",
  category: "site",
  icon: "building",
  keywords: ["footer", "links", "contact", "legal", "copyright"],
  chrome: { width: "wide", spacingTop: "lg", spacingBottom: "md", entrance: "none" },
  fields: {
    logo: f.media({ label: "Logo" }),
    name: f.text({ label: "Site name", default: "My store", inline: false }),
    blurb: f.text({ label: "Short description", multiline: true, default: "" }),
    columns: f.list(
      {
        title: f.text({ label: "Title", default: "Shop" }),
        links: f.list(
          { label: f.text({ label: "Label", default: "Link" }), link: f.link({ label: "Link" }) },
          { label: "Links", summary: "label", itemLabel: "Link", default: [{}] },
        ),
      },
      { label: "Columns", summary: "title", itemLabel: "Column", max: 4, default: [{}] },
    ),
    email: f.text({ label: "Email", translatable: false, inline: false }),
    phone: f.text({ label: "Phone", translatable: false, inline: false }),
    address: f.text({ label: "Address", multiline: true }),
    legal: f.text({ label: "Legal line ({year} and {site} are filled in)", default: "© {year} {site}. All rights reserved.", inline: false }),
  },
  render: ({ logo, name, blurb, columns, email, phone, address, legal }, ctx) => {
    const siteName = textOf(name) || ctx.metadata.site?.name || "";
    const contact = email || phone || address;
    return (
      <footer className="qb-site-footer">
        <div className="qb-site-footer-grid">
          <div className="qb-site-footer-brand">
            <Brand logo={logo} name={siteName} ctx={ctx} />
            {blurb ? <p className="qb-small qb-muted">{blurb}</p> : null}
          </div>
          {columns.map((col, i) => (
            <div key={i}>
              <h2 className="qb-site-footer-title">{col.title}</h2>
              <ul>
                {col.links.map((l, j) => (
                  <li key={j}>
                    <NavLink label={l.label} link={l.link} ctx={ctx} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {contact ? (
            <address>
              {email ? (
                <a href={ctx.isEditing ? undefined : `mailto:${email}`}>
                  <IconGlyph name="mail" size="1em" /> {email}
                </a>
              ) : null}
              {phone ? (
                <a href={ctx.isEditing ? undefined : `tel:${phone.replace(/[^\d+]/g, "")}`}>
                  <IconGlyph name="phone" size="1em" /> {phone}
                </a>
              ) : null}
              {address ? (
                <span style={{ whiteSpace: "pre-line" }}>
                  <IconGlyph name="map-pin" size="1em" /> {address}
                </span>
              ) : null}
            </address>
          ) : null}
        </div>
        {legal ? (
          <p className="qb-site-legal qb-small qb-muted">
            {textOf(legal).replace("{year}", String(new Date().getFullYear())).replace("{site}", siteName)}
          </p>
        ) : null}
      </footer>
    );
  },
});

export const siteChromeSections = [SiteHeader, SiteFooter];
