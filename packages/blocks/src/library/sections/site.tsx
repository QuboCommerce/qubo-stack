import { defineSection, f, linkTarget, resolveLink, resolveMedia, textOf, type BlockContext, type LinkValue } from "../../core";
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
    <a className="qb-site-brand" href={ctx.isEditing ? undefined : "/"} aria-label={name}>
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
  children: f.list(
    {
      label: f.text({ label: "Label", default: "Link" }),
      link: f.link({ label: "Link" }),
    },
    { label: "Dropdown links", summary: "label", itemLabel: "Link", default: [] },
  ),
};

/**
 * Site-wide header (lives in the `header` section group). The mobile menu is a
 * <details> disclosure, so it works without client JavaScript.
 */
export const SiteHeader = defineSection({
  name: "SiteHeader",
  label: "Site header",
  description: "Logo, main navigation with optional dropdowns, and search, account and cart shortcuts.",
  category: "site",
  icon: "house",
  keywords: ["header", "navigation", "menu", "navbar", "logo"],
  chrome: { width: "wide", spacingTop: "xs", spacingBottom: "xs", entrance: "none" },
  fields: {
    logo: f.media({ label: "Logo" }),
    name: f.text({ label: "Site name (shown without a logo)", default: "My store", inline: false }),
    links: f.list(navItem, { label: "Navigation", summary: "label", itemLabel: "Menu item", default: [{}] }),
    showSearch: f.toggle({ label: "Search", default: true }),
    searchPlaceholder: f.text({ label: "Search placeholder", default: "Search", inline: false }),
    showAccount: f.toggle({ label: "Account", default: true }),
    showCart: f.toggle({ label: "Cart", default: true }),
    ctaLabel: f.text({ label: "Button label" }),
    ctaLink: f.link({ label: "Button link" }),
  },
  render: ({ logo, name, links, showSearch, searchPlaceholder, showAccount, showCart, ctaLabel, ctaLink }, ctx) => {
    const siteName = textOf(name) || ctx.metadata.site?.name || "";
    const nav = (
      <ul className="qb-site-nav-list">
        {links.map((item, i) =>
          item.children.length ? (
            <li key={i} className="qb-site-nav-item">
              <details className="qb-site-dropdown">
                <summary>
                  {item.label} <IconGlyph name="chevron-down" size="0.9em" />
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
            </li>
          ) : (
            <li key={i} className="qb-site-nav-item">
              <NavLink label={item.label} link={item.link} ctx={ctx} />
            </li>
          ),
        )}
      </ul>
    );
    const commerce = has(ctx, "commerce");
    const cta =
      ctaLabel && ctaLink?.value ? (
        <a className="qb-button qb-site-cta" data-emphasis="primary" data-size="sm" href={ctx.isEditing ? undefined : resolveLink(ctaLink, ctx.metadata)} {...linkTarget(ctaLink)}>
          <span>{ctaLabel}</span>
        </a>
      ) : null;
    return (
      <header className="qb-site-header">
        <Brand logo={logo} name={siteName} ctx={ctx} />
        <nav className="qb-site-nav" aria-label="Main">
          {nav}
        </nav>
        <div className="qb-site-actions">
          {showSearch ? (
            <>
              <form className="qb-site-search" action="/search" role="search">
                <IconGlyph name="search" size="1em" />
                <input type="search" name="q" placeholder={textOf(searchPlaceholder)} aria-label={textOf(searchPlaceholder) || "Search"} />
              </form>
              <a className="qb-site-icon qb-site-search-icon" href={ctx.isEditing ? undefined : "/search"} aria-label={textOf(searchPlaceholder) || "Search"}>
                <IconGlyph name="search" size="1.25em" />
              </a>
            </>
          ) : null}
          {showAccount && has(ctx, "accounts") ? (
            <a className="qb-site-icon" href={ctx.isEditing ? undefined : "/account"} aria-label="Account">
              <IconGlyph name="user" size="1.25em" />
            </a>
          ) : null}
          {showCart && commerce ? (
            <a className="qb-site-icon" href={ctx.isEditing ? undefined : "/cart"} aria-label="Cart">
              <IconGlyph name="shopping-bag" size="1.25em" />
              {ctx.metadata.site?.id && !ctx.isEditing ? <CartCount siteId={ctx.metadata.site.id} /> : null}
            </a>
          ) : null}
          {cta}
          <details className="qb-site-menu">
            <summary aria-label="Menu">
              <IconGlyph name="menu" size="1.4em" />
            </summary>
            <nav aria-label="Mobile">
              {nav}
              {cta}
            </nav>
          </details>
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
                <span>
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
