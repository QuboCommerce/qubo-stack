import { Fragment, type CSSProperties, type ReactNode } from "react";
import { defineSection, f, textOf } from "../../../core";
import { A, Arrow, brandFields, Icon, KIT, Marked, mediaSrc, PartnerField, partnersField, Wordmark } from "./shared";

const link = (label: string, href: string, kind: "url" | "anchor" | "collection" | "page" | "phone" = "url") => ({
  label,
  link: { kind, value: href },
});

/**
 * Utility bar, sticky header and the full-screen catalogue menu: product
 * families as tabs (an accordion on phones), a looping film behind, and a
 * drifting field of partner logos underneath.
 */
export const ChapterMasthead = defineSection({
  name: "ChapterMasthead",
  label: "Chapters: masthead",
  description: "Utility bar, sticky header and a full-screen catalogue menu with families, film and partner logos.",
  category: "site",
  kit: "chapters",
  icon: "panel-top",
  keywords: ["header", "navigation", "menu", "mega menu", "chapters"],
  chrome: { spacingTop: "none", spacingBottom: "none", width: "full", entrance: "none" },
  fields: {
    skipLabel: f.text({ label: "Skip link", default: "Skip to content", group: "advanced" }),
    skipTarget: f.text({ label: "Skip link target id", default: "main", translatable: false, group: "advanced" }),
    utility: f.group(
      {
        place: f.text({ label: "Place", default: "City, Region" }),
        since: f.text({ label: "Since", default: "Since 2008" }),
        hours: f.text({ inline: false, label: "Hours", default: "Mon–Fri 9–18", description: "A · starts a new part." }),
        phone: f.text({ label: "Phone", default: "+32 2 000 00 00", translatable: false }),
      },
      { label: "Utility bar", collapsed: true },
    ),
    brand: f.group(brandFields(), { label: "Brand", collapsed: true }),
    home: f.link({ label: "Logo link", default: { kind: "page", value: "home" } }),
    browseLabel: f.text({ inline: false, label: "Menu button", default: "Browse the range" }),
    mobileLabel: f.text({ label: "Menu button on phones", default: "Menu" }),
    links: f.list({ label: f.text({ label: "Label", default: "Link" }), link: f.link({ label: "Link" }) }, {
      label: "Header links",
      summary: "label",
      itemLabel: "Link",
      default: [link("Second hand", "#used", "anchor"), link("By trade", "#trades", "anchor"), link("Showroom", "#visit", "anchor")],
    }),
    contact: f.group(
      { label: f.text({ label: "Label", default: "Contact us" }), link: f.link({ label: "Link", default: { kind: "anchor", value: "contact" } }) },
      { label: "Contact button", collapsed: true },
    ),
    menu: f.group(
      {
        title: f.text({ inline: false, label: "Menu name", default: "The range" }),
        close: f.text({ label: "Close label", default: "Close" }),
        hookQuestion: f.text({ label: "Hook, question", default: "A project?" }),
        hookAnswer: f.text({ label: "Hook, answer", default: "The answer" }),
        hookBrand: f.text({ label: "Hook, brand", default: "Brand." }),
        intro: f.text({ label: "Intro", multiline: true, inline: false, default: "The right equipment.\nWe help you find it." }),
        quote: f.text({ label: "Quote", inline: false, default: "Brand, *the* professional catalogue." }),
        video: f.media({ label: "Background film", accept: "video" }),
        poster: f.media({ label: "Film poster", accept: "image" }),
        tabletLinks: f.list({ label: f.text({ label: "Label", default: "Link" }), link: f.link({ label: "Link" }) }, {
          label: "Tablet links",
          summary: "label",
          itemLabel: "Link",
        }),
        quickLinks: f.list({ label: f.text({ label: "Label", default: "Link" }), link: f.link({ label: "Link" }) }, {
          label: "Phone quick links",
          summary: "label",
          itemLabel: "Link",
        }),
        allLabel: f.text({ label: "Catalogue button", default: "Browse the whole catalogue" }),
        allLink: f.link({ label: "Catalogue link", default: { kind: "collection", value: "all" } }),
        callQuestion: f.text({ label: "Call prompt", default: "Need advice?" }),
        familyLabel: f.text({ label: "Family link", default: "See the whole family" }),
        countLabel: f.text({ label: "Sub-family count", default: "sub-families" }),
        familiesLabel: f.text({ inline: false, label: "Families label (screen readers)", default: "Product families", group: "advanced" }),
      },
      { label: "Menu", collapsed: true },
    ),
    families: f.list(
      {
        name: f.text({ label: "Name", default: "Family" }),
        icon: f.icon({ label: "Icon", default: "line-steel-panel" }),
        summary: f.text({ label: "Summary", default: "What this family covers." }),
        link: f.link({ label: "Family page", default: { kind: "collection", value: "all" } }),
        links: f.list({ label: f.text({ label: "Label", default: "Sub-family" }), link: f.link({ label: "Link" }) }, {
          label: "Sub-families",
          summary: "label",
          itemLabel: "Sub-family",
        }),
      },
      { label: "Product families", summary: "name", itemLabel: "Family", default: [{ name: "Cold" }, { name: "Cooking" }] },
    ),
    partnersLabel: f.text({ label: "Partners label", default: "Our partners" }),
    partnersShow: f.text({ label: "Show partners (screen readers)", default: "Show our partners", group: "advanced" }),
    partnersHide: f.text({ label: "Hide partners (screen readers)", default: "Hide our partners", group: "advanced" }),
    partners: partnersField(),
  },
  render: ({ id, skipLabel, skipTarget, utility, brand, home, browseLabel, mobileLabel, links, contact, menu, families, partnersLabel, partnersShow, partnersHide, partners }, ctx) => {
    const menuId = `${id || "chapters"}-menu`;
    const phone = textOf(utility.phone);
    const tel = { kind: "phone" as const, value: phone };
    const hours = textOf(utility.hours).split("·").map((s) => s.trim());
    const video = mediaSrc(menu.video, ctx);
    const poster = mediaSrc(menu.poster, ctx);
    const quote = (
      <blockquote className="qb-ch-mega-menu__brand-quote">
        <span className="qb-ch-brand-quote__open" aria-hidden="true">“</span>
        <p>
          <Marked value={menu.quote} />
        </p>
        <span className="qb-ch-brand-quote__close" aria-hidden="true">”</span>
      </blockquote>
    );
    const familyLinks = (fam: (typeof families)[number], cls: string) => (
      <>
        {fam.links.map((l, i) => (
          <A key={i} link={l.link} ctx={ctx} className={cls}>
            <span>{l.label as ReactNode}</span>
            <span aria-hidden="true">↗</span>
          </A>
        ))}
      </>
    );
    return (
      <div {...KIT} className="qb-ch-masthead" data-ch-masthead="">
        <a className="qb-ch-skip-link" href={`#${textOf(skipTarget)}`}>
          {skipLabel}
        </a>
        <div className="qb-ch-utility-bar">
          <div className="qb-ch-shell qb-ch-utility-bar__inner">
            <p>
              <Icon name="line-pin" className="qb-ch-utility-location" /> {utility.place} <span className="qb-ch-utility-separator">/</span> {utility.since}
            </p>
            <p className="qb-ch-utility-hours">
              {hours.map((h, i) => (
                <Fragment key={i}>
                  {i ? (
                    <>
                      {" "}
                      <span className="qb-ch-utility-separator">·</span>{" "}
                    </>
                  ) : null}
                  {h}
                </Fragment>
              ))}
            </p>
            <A className="qb-ch-utility-phone" link={tel} ctx={ctx}>
              {phone}
              <Arrow />
            </A>
          </div>
        </div>

        <header className="qb-ch-site-header">
          <div className="qb-ch-shell qb-ch-site-header__inner">
            <A className="qb-ch-wordmark" link={home} ctx={ctx} aria-label={textOf(brand.name)}>
              <Wordmark brand={brand} ctx={ctx} size={44} />
            </A>
            <nav className="qb-ch-primary-nav" aria-label={textOf(menu.title)}>
              <button
                className="qb-ch-menu-toggle qb-ch-menu-toggle--desktop"
                type="button"
                aria-expanded="false"
                aria-controls={menuId}
                data-ch-menu-toggle=""
              >
                <Icon name="line-browse-grid" className="qb-ch-nav-browse-icon" /> {browseLabel}
              </button>
              {links.map((l, i) => (
                <A key={i} link={l.link} ctx={ctx}>
                  {l.label as ReactNode}
                </A>
              ))}
              <A className="qb-ch-nav-contact qb-ch-button qb-ch-button--metal" link={contact.link} ctx={ctx}>
                {contact.label as ReactNode}
              </A>
            </nav>
            <button
              className="qb-ch-menu-toggle qb-ch-menu-toggle--mobile"
              type="button"
              aria-expanded="false"
              aria-controls={menuId}
              aria-label={textOf(browseLabel)}
              data-ch-menu-toggle=""
            >
              <Icon name="line-browse-grid" className="qb-ch-nav-browse-icon" />
              <span>{mobileLabel}</span>
            </button>
          </div>

          <nav
            className="qb-ch-mega-menu qb-ch-mega-menu--split"
            id={menuId}
            aria-label={textOf(menu.title)}
            aria-hidden="true"
            hidden
            inert
            style={poster ? ({ "--qb-ch-menu-poster": `url(${JSON.stringify(poster)})` } as CSSProperties) : undefined}
          >
            <div className="qb-ch-mega-menu__surface">
              <div className="qb-ch-mega-menu__visual" aria-hidden="true">
                {video ? (
                  <video className="qb-ch-mega-menu__video" muted playsInline loop preload="none" poster={poster}>
                    <source src={video} type="video/mp4" />
                  </video>
                ) : null}
                <div className="qb-ch-mega-menu__visual-shade" />
              </div>
              <div className="qb-ch-mega-menu__top qb-ch-shell">
                <div className="qb-ch-mega-menu__eyebrow">
                  {mediaSrc(brand.logo, ctx) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="qb-ch-mega-menu__brand-mark" src={mediaSrc(brand.logo, ctx)} alt="" aria-hidden="true" width={26} height={26} />
                  ) : null}
                  <strong>{brand.name as ReactNode}</strong>
                  <span>/</span>
                  <span>{menu.title}</span>
                </div>
                <button className="qb-ch-mega-menu__close" type="button">
                  <span>{menu.close}</span>
                  <span aria-hidden="true">×</span>
                </button>
              </div>
              <div className="qb-ch-mega-menu__inner qb-ch-shell">
                <div className="qb-ch-mega-menu__intro">
                  <h2>
                    <span className="qb-ch-menu-hook__line">{menu.hookQuestion}</span>{" "}
                    <span className="qb-ch-menu-hook__line qb-ch-menu-hook__solution">{menu.hookAnswer}</span>{" "}
                    <em className="qb-ch-menu-hook__line qb-ch-menu-hook__brand">{menu.hookBrand}</em>
                  </h2>
                  <div className="qb-ch-mega-menu__intro-copy">
                    <p>
                      <Marked value={menu.intro} />
                    </p>
                    <div className="qb-ch-mega-menu__tablet-links">
                      {menu.tabletLinks.map((l, i) => (
                        <A key={i} link={l.link} ctx={ctx}>
                          {l.label as ReactNode}
                        </A>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="qb-ch-mega-menu__desktop">
                  <div className="qb-ch-mega-menu__category-rail">
                    <div className="qb-ch-mega-menu__category-tabs" role="tablist" aria-label={textOf(menu.familiesLabel)} aria-orientation="vertical">
                      {families.map((fam, i) => (
                        <button
                          key={i}
                          className="qb-ch-mega-category-tab"
                          type="button"
                          id={`${menuId}-tab-${i}`}
                          role="tab"
                          aria-controls={`${menuId}-panel-${i}`}
                          aria-selected={i === 0}
                          tabIndex={i === 0 ? 0 : -1}
                        >
                          <Icon name={fam.icon} className="qb-ch-mega-category-tab__icon" />
                          <span className="qb-ch-mega-category-tab__name">{fam.name as ReactNode}</span>
                          <span className="qb-ch-mega-category-tab__index" aria-hidden="true">
                            ›
                          </span>
                        </button>
                      ))}
                    </div>
                    {quote}
                  </div>
                  {families.map((fam, i) => (
                    <div
                      key={i}
                      className="qb-ch-mega-menu__category-content"
                      id={`${menuId}-panel-${i}`}
                      role="tabpanel"
                      aria-labelledby={`${menuId}-tab-${i}`}
                      hidden={i !== 0}
                    >
                      <div className="qb-ch-mega-menu__content-heading">
                        <Icon name={fam.icon} className="qb-ch-mega-menu__content-icon" />
                        <h3>{fam.name as ReactNode}</h3>
                      </div>
                      <p className="qb-ch-mega-menu__content-note">
                        {fam.summary as ReactNode}
                        <small>
                          {fam.links.length} {menu.countLabel}
                        </small>
                      </p>
                      <div className="qb-ch-mega-menu__links">{familyLinks(fam, "qb-ch-mega-menu__link")}</div>
                      <A className="qb-ch-mega-menu__family-link" link={fam.link} ctx={ctx}>
                        {menu.familyLabel}
                        <Arrow />
                      </A>
                    </div>
                  ))}
                </div>
                <div className="qb-ch-mega-menu__mobile">
                  <div className="qb-ch-mega-menu__mobile-groups">
                    {families.map((fam, i) => (
                      <section key={i} className="qb-ch-mega-mobile-group">
                        <button className="qb-ch-mega-mobile-group__button" type="button" aria-expanded="false" aria-controls={`${menuId}-group-${i}`}>
                          <Icon name={fam.icon} className="qb-ch-mega-mobile-group__icon" />
                          <span className="qb-ch-mega-mobile-group__name">{fam.name as ReactNode}</span>
                          <span className="qb-ch-mega-mobile-group__count">
                            {String(fam.links.length).padStart(2, "0")}{" "}
                            <span className="qb-ch-mega-mobile-group__chevron" aria-hidden="true">
                              ＋
                            </span>
                          </span>
                        </button>
                        <div className="qb-ch-mega-mobile-group__links" id={`${menuId}-group-${i}`} aria-hidden="true" inert>
                          <div className="qb-ch-mega-mobile-group__links-inner">
                            {familyLinks(fam, "qb-ch-mega-menu__link")}
                            <A className="qb-ch-mega-menu__family-link" link={fam.link} ctx={ctx}>
                              {menu.familyLabel}
                              <Arrow />
                            </A>
                          </div>
                        </div>
                      </section>
                    ))}
                  </div>
                  {quote}
                  <div className="qb-ch-mega-menu__quick-links">
                    {menu.quickLinks.map((l, i) => (
                      <A key={i} link={l.link} ctx={ctx}>
                        {l.label as ReactNode}
                        <Arrow />
                      </A>
                    ))}
                  </div>
                </div>
                <div className="qb-ch-mega-menu__bottom">
                  <A className="qb-ch-mega-menu__all qb-ch-button qb-ch-button--metal" link={menu.allLink} ctx={ctx}>
                    {menu.allLabel}
                    <Arrow />
                  </A>
                  <A className="qb-ch-mega-menu__call" link={tel} ctx={ctx}>
                    <span>{menu.callQuestion}</span>
                    <strong>{phone}</strong>
                  </A>
                </div>
              </div>
              {partners.length ? (
                <div className="qb-ch-mega-menu__partners-strip">
                  <p className="qb-ch-mega-menu__partners-label qb-ch-mega-menu__partners-label--desktop">
                    <Icon name="line-chain-link" className="qb-ch-section-icon" /> {partnersLabel}
                  </p>
                  <button
                    className="qb-ch-mega-menu__partners-toggle"
                    type="button"
                    aria-expanded="false"
                    aria-controls={`${menuId}-partners`}
                    data-show-label={textOf(partnersShow)}
                    data-hide-label={textOf(partnersHide)}
                  >
                    <Icon name="line-chain-link" className="qb-ch-section-icon" />
                    <span>{partnersLabel}</span>
                    <svg className="qb-ch-partner-chevron" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m6 15 6-6 6 6" />
                    </svg>
                  </button>
                </div>
              ) : null}
            </div>
            {partners.length ? (
              <div className="qb-ch-mega-menu__reserve" id={`${menuId}-partners`} aria-label={textOf(partnersLabel)} aria-hidden="true" inert>
                <PartnerField partners={partners} ctx={ctx} variant="menu" label={textOf(partnersLabel)} duration={56000} hoverRate={0.45} />
              </div>
            ) : null}
          </nav>
        </header>
      </div>
    );
  },
});
