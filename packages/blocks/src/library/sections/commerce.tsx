import { defineSection, f, linkTarget, localHref, resolveLink, type BlockContext } from "../../core";
import { IconGlyph } from "../icons";
import { BuyBox, CartView, type BuyVariant, type CartLine } from "../cart";

/** What the host prefetches into `metadata.data[nodeId]` for ProductDetail. */
export type ProductDetailData = {
  slug: string;
  title: string;
  brand: string | null;
  description: string | null;
  sku: string | null;
  images: { src: string; alt: string }[];
  /** Raw decimal strings; formatted with the site locale/currency. */
  price: string;
  compareAt: string | null;
  variants: BuyVariant[];
};

const sampleProduct: ProductDetailData = {
  slug: "sample",
  title: "Product name",
  brand: "Brand",
  description: "A short description of the product, its use and what makes it stand out.",
  sku: "SKU-0001",
  images: [],
  price: "1299.00",
  compareAt: "1499.00",
  variants: [{ id: "sample", name: null, price: "1299.00", available: null }],
};

const siteMoney = (ctx: BlockContext) => {
  const locale = ctx.metadata.site?.locale ?? ctx.metadata.locale ?? "en";
  const currency = ctx.metadata.site?.currency ?? "EUR";
  return { locale, currency, format: (v: string) => new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(v)) };
};

export const ProductDetail = defineSection({
  name: "ProductDetail",
  label: "Product details",
  description: "Gallery, title, price, options and add-to-cart for the product being viewed.",
  category: "commerce",
  icon: "shopping-bag",
  requires: ["commerce"],
  keywords: ["product", "pdp", "buy", "add to cart", "price", "gallery"],
  fields: {
    showBrand: f.toggle({ label: "Show brand", default: true }),
    showSku: f.toggle({ label: "Show SKU", default: false }),
    showDescription: f.toggle({ label: "Show description", default: true }),
    imageAspect: f.select(["1/1", "4/5", "3/4", "4/3"], { label: "Image ratio", default: "1/1", group: "style" }),
    galleryPosition: f.select(["start", "end"], { label: "Gallery side", default: "start", group: "layout" }),
    secondaryLabel: f.text({ label: "Secondary button", default: "", inline: false }),
    secondaryLink: f.link({ label: "Secondary button link" }),
    notes: f.list(
      { icon: f.icon({ label: "Icon", default: "check" }), text: f.text({ label: "Text", default: "Fast delivery", inline: false }) },
      { label: "Reassurance notes", summary: "text", itemLabel: "Note", default: [] },
    ),
    labels: f.group(
      {
        add: f.text({ label: "Add to cart", default: "Add to cart", inline: false }),
        added: f.text({ label: "Added message", default: "Added to your cart.", inline: false }),
        viewCart: f.text({ label: "View cart link", default: "View cart", inline: false }),
        soldOut: f.text({ label: "Sold out", default: "Sold out", inline: false }),
        option: f.text({ label: "Option", default: "Option", inline: false }),
        quantity: f.text({ label: "Quantity", default: "Quantity", inline: false }),
      },
      { label: "Labels", collapsed: true },
    ),
  },
  render: (p, ctx) => {
    const data = (ctx.metadata.data?.[ctx.id] as ProductDetailData | undefined) ?? (ctx.isEditing || ctx.metadata.blueprint ? sampleProduct : undefined);
    if (!data) return <></>;
    const money = siteMoney(ctx);
    const [main, ...rest] = data.images;
    const secondary = p.secondaryLabel ? resolveLink(p.secondaryLink, ctx.metadata) : undefined;
    const paragraphs = data.description?.split(/\n{2,}|\r\n\r\n/).map((s) => s.trim()).filter(Boolean) ?? [];
    return (
      <div className="qb-pdp" data-gallery={p.galleryPosition} style={{ "--qb-media-aspect": p.imageAspect } as React.CSSProperties}>
        <div className="qb-pdp-gallery">
          {main ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="qb-pdp-main" src={main.src} alt={main.alt || data.title} fetchPriority="high" />
          ) : (
            <span className="qb-media-placeholder qb-pdp-main" aria-hidden="true" />
          )}
          {rest.length ? (
            <ul className="qb-pdp-thumbs">
              {rest.slice(0, 8).map((img, i) => (
                <li key={i}>
                  <a href={ctx.isEditing ? undefined : img.src} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.src} alt={img.alt || `${data.title} ${i + 2}`} loading="lazy" />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="qb-pdp-info">
          {p.showBrand && data.brand ? <p className="qb-eyebrow">{data.brand}</p> : null}
          <h1 className="qb-heading qb-font-heading qb-pdp-title">{data.title}</h1>
          <p className="qb-price" data-size="lg">
            <strong>{money.format(data.price)}</strong>
            {data.compareAt && Number(data.compareAt) > Number(data.price) ? <s className="qb-muted">{money.format(data.compareAt)}</s> : null}
          </p>
          {p.showSku && data.sku ? <p className="qb-muted qb-small">SKU {data.sku}</p> : null}
          {ctx.isEditing || !ctx.metadata.site?.id ? (
            <div className="qb-buybox">
              <div className="qb-buybox-row">
                <span className="qb-qty" aria-hidden="true">
                  <button type="button">−</button>
                  <input readOnly value={1} />
                  <button type="button">+</button>
                </span>
                <button type="button" className="qb-button" data-emphasis="primary">
                  {p.labels.add} — {money.format(data.price)}
                </button>
              </div>
            </div>
          ) : (
            <BuyBox
              siteId={ctx.metadata.site.id}
              locale={money.locale}
              currency={money.currency}
              product={{ slug: data.slug, title: data.title, image: main?.src ?? null }}
              variants={data.variants}
              labels={{ ...p.labels, cartHref: localHref("/cart", ctx.metadata) }}
            />
          )}
          {secondary || (ctx.isEditing && p.secondaryLabel) ? (
            <a className="qb-button" data-emphasis="outline" href={ctx.isEditing ? undefined : secondary} {...linkTarget(p.secondaryLink)}>
              {p.secondaryLabel}
            </a>
          ) : null}
          {p.notes.length ? (
            <ul className="qb-pdp-notes">
              {p.notes.map((n, i) => (
                <li key={i}>
                  <IconGlyph name={n.icon} size="1.1em" />
                  <span>{n.text}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {p.showDescription && paragraphs.length ? (
            <div className="qb-prose qb-pdp-description">
              {paragraphs.map((t, i) => (
                <p key={i}>{t}</p>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  },
});

const sampleLines: CartLine[] = [
  { variantId: "a", productSlug: "#", title: "Product name", variantName: null, unitPrice: "1299.00", image: null, quantity: 1 },
  { variantId: "b", productSlug: "#", title: "Another product", variantName: "Large", unitPrice: "349.00", image: null, quantity: 2 },
];

export const Cart = defineSection({
  name: "Cart",
  label: "Cart",
  description: "The visitor's cart with quantities, subtotal and secure checkout.",
  category: "commerce",
  icon: "shopping-bag",
  requires: ["commerce"],
  keywords: ["cart", "basket", "checkout", "bag"],
  fields: {
    emptyText: f.text({ label: "Empty cart text", default: "Your cart is empty.", inline: false }),
    continueLabel: f.text({ label: "Continue shopping label", default: "Continue shopping", inline: false }),
    continueLink: f.link({ label: "Continue shopping link", default: { kind: "collection", value: "all" } }),
    checkoutLabel: f.text({ label: "Checkout button", default: "Secure checkout", inline: false }),
    note: f.text({ label: "Note under subtotal", default: "Taxes and shipping are calculated at checkout.", inline: false }),
    labels: f.group(
      {
        subtotal: f.text({ label: "Subtotal", default: "Subtotal", inline: false }),
        remove: f.text({ label: "Remove", default: "Remove", inline: false }),
        quantity: f.text({ label: "Quantity", default: "Quantity", inline: false }),
        redirecting: f.text({ label: "Redirecting", default: "Redirecting…", inline: false }),
        error: f.text({ label: "Checkout error", default: "Checkout is unavailable right now. Please try again or contact us.", inline: false }),
      },
      { label: "Labels", collapsed: true },
    ),
  },
  render: (p, ctx) => {
    const money = siteMoney(ctx);
    const editing = ctx.isEditing || !ctx.metadata.site?.id;
    return (
      <CartView
        siteId={ctx.metadata.site?.id ?? "preview"}
        locale={money.locale}
        currency={money.currency}
        preview={editing ? sampleLines : undefined}
        labels={{
          ...p.labels,
          empty: p.emptyText,
          continueLabel: p.continueLabel,
          continueHref: resolveLink(p.continueLink, ctx.metadata) ?? localHref("/", ctx.metadata),
          basePath: ctx.metadata.basePath,
          checkout: p.checkoutLabel,
          note: p.note,
        }}
      />
    );
  },
});

export const commerceSections = [ProductDetail, Cart];
