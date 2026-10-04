"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

/**
 * Client cart: localStorage per site (and per origin, since storage is). Lines
 * hold display data only; the API re-prices everything at checkout.
 */
export type CartLine = {
  variantId: string;
  productSlug: string;
  title: string;
  variantName: string | null;
  unitPrice: string;
  image: string | null;
  quantity: number;
};

export const MAX_CART_LINES = 10;
export const MAX_LINE_QUANTITY = 20;

const keyFor = (siteId: string) => `qubo-cart:${siteId}`;
const EVENT = "qubo-cart";
const EMPTY: CartLine[] = [];
const snapshots = new Map<string, { raw: string | null; lines: CartLine[] }>();

function isLine(v: unknown): v is CartLine {
  const l = v as Partial<CartLine> | null;
  return Boolean(l && typeof l.variantId === "string" && typeof l.title === "string" && typeof l.unitPrice === "string" && Number.isInteger(l.quantity) && l.quantity! > 0);
}

function read(siteId: string): CartLine[] {
  if (typeof window === "undefined") return EMPTY;
  const raw = window.localStorage.getItem(keyFor(siteId));
  const cached = snapshots.get(siteId);
  if (cached && cached.raw === raw) return cached.lines;
  let lines: CartLine[] = EMPTY;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      lines = parsed
        .filter(isLine)
        .slice(0, MAX_CART_LINES)
        .map((l) => ({ ...l, quantity: Math.min(l.quantity, MAX_LINE_QUANTITY) }));
    }
  } catch {
    window.localStorage.removeItem(keyFor(siteId));
  }
  snapshots.set(siteId, { raw, lines });
  return lines;
}

function write(siteId: string, lines: CartLine[]) {
  window.localStorage.setItem(keyFor(siteId), JSON.stringify(lines));
  window.dispatchEvent(new CustomEvent(EVENT, { detail: siteId }));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

export function useCart(siteId: string) {
  const lines = useSyncExternalStore(subscribe, () => read(siteId), () => EMPTY);
  const update = useCallback((fn: (lines: CartLine[]) => CartLine[]) => write(siteId, fn(read(siteId))), [siteId]);
  return {
    lines,
    count: lines.reduce((n, l) => n + l.quantity, 0),
    add: (line: Omit<CartLine, "quantity">, quantity = 1) =>
      update((cur) => {
        const hit = cur.find((l) => l.variantId === line.variantId);
        if (hit) return cur.map((l) => (l === hit ? { ...l, quantity: Math.min(l.quantity + quantity, MAX_LINE_QUANTITY) } : l));
        return cur.length >= MAX_CART_LINES ? cur : [...cur, { ...line, quantity: Math.min(quantity, MAX_LINE_QUANTITY) }];
      }),
    setQuantity: (variantId: string, quantity: number) =>
      update((cur) => {
        const q = Math.min(Math.max(Math.trunc(quantity) || 0, 0), MAX_LINE_QUANTITY);
        return q === 0 ? cur.filter((l) => l.variantId !== variantId) : cur.map((l) => (l.variantId === variantId ? { ...l, quantity: q } : l));
      }),
    remove: (variantId: string) => update((cur) => cur.filter((l) => l.variantId !== variantId)),
    clear: () => update(() => []),
  };
}

const formatter = (locale: string, currency: string) => {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency });
  } catch {
    return new Intl.NumberFormat("en", { style: "currency", currency: "EUR" });
  }
};

/** Header badge; renders nothing until the cart has items (and on the server). */
export function CartCount({ siteId }: { siteId: string }) {
  const { count } = useCart(siteId);
  return count ? <span className="qb-cart-count" aria-label={String(count)}>{count > 99 ? "99+" : count}</span> : null;
}

export type BuyVariant = { id: string; name: string | null; price: string; available: number | null };

export function BuyBox({
  siteId,
  locale,
  currency,
  product,
  variants,
  labels,
}: {
  siteId: string;
  locale: string;
  currency: string;
  product: { slug: string; title: string; image: string | null };
  variants: BuyVariant[];
  labels: { add: string; added: string; soldOut: string; option: string; quantity: string; viewCart: string; cartHref: string };
}) {
  const cart = useCart(siteId);
  const firstAvailable = variants.find((v) => v.available === null || v.available > 0) ?? variants[0];
  const [variantId, setVariantId] = useState(firstAvailable?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 4000);
    return () => clearTimeout(t);
  }, [added]);
  const selected = variants.find((v) => v.id === variantId);
  const soldOut = !selected || selected.available === 0;
  const max = Math.min(MAX_LINE_QUANTITY, selected?.available ?? MAX_LINE_QUANTITY);
  const fmt = formatter(locale, currency);
  const named = variants.filter((v) => v.name && v.name !== "Default");

  return (
    <div className="qb-buybox">
      {named.length > 1 ? (
        <label className="qb-field">
          <span className="qb-label">{labels.option}</span>
          <select className="qb-input" value={variantId} onChange={(e) => setVariantId(e.target.value)}>
            {variants.map((v) => (
              <option key={v.id} value={v.id} disabled={v.available === 0}>
                {v.name} — {fmt.format(Number(v.price))}
                {v.available === 0 ? ` (${labels.soldOut})` : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="qb-buybox-row">
        <label className="qb-qty">
          <span className="qb-sr-only">{labels.quantity}</span>
          <button type="button" aria-label="−" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={soldOut || quantity <= 1}>
            −
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={max}
            value={quantity}
            disabled={soldOut}
            onChange={(e) => setQuantity(Math.min(Math.max(1, Number(e.target.value) || 1), max))}
          />
          <button type="button" aria-label="+" onClick={() => setQuantity((q) => Math.min(max, q + 1))} disabled={soldOut || quantity >= max}>
            +
          </button>
        </label>
        <button
          type="button"
          className="qb-button"
          data-emphasis="primary"
          disabled={soldOut}
          onClick={() => {
            if (!selected) return;
            cart.add({ variantId: selected.id, productSlug: product.slug, title: product.title, variantName: selected.name, unitPrice: selected.price, image: product.image }, quantity);
            setAdded(true);
          }}
        >
          {soldOut ? labels.soldOut : `${labels.add} — ${fmt.format(Number(selected.price) * quantity)}`}
        </button>
      </div>
      <p className="qb-buybox-status" role="status" aria-live="polite">
        {added ? (
          <>
            {labels.added} <a href={labels.cartHref}>{labels.viewCart}</a>
          </>
        ) : null}
      </p>
    </div>
  );
}

export type CartLabels = {
  empty: string;
  continueLabel: string;
  continueHref: string;
  checkout: string;
  redirecting: string;
  subtotal: string;
  note: string;
  remove: string;
  quantity: string;
  error: string;
};

export function CartView({ siteId, locale, currency, labels, preview }: { siteId: string; locale: string; currency: string; labels: CartLabels; preview?: CartLine[] }) {
  const cart = useCart(siteId);
  const lines = preview ?? cart.lines;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fmt = formatter(locale, currency);
  const subtotal = lines.reduce((s, l) => s + Number(l.unitPrice) * l.quantity, 0);

  async function checkout() {
    if (preview) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: lines.map(({ variantId, quantity }) => ({ variantId, quantity })) }),
      });
      const payload = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !payload.url) throw new Error(payload.error ?? "error");
      window.location.assign(payload.url);
    } catch {
      setError(labels.error);
      setBusy(false);
    }
  }

  if (!lines.length) {
    return (
      <div className="qb-cart-empty">
        <p className="qb-muted">{labels.empty}</p>
        <a className="qb-button" data-emphasis="primary" href={labels.continueHref}>
          {labels.continueLabel}
        </a>
      </div>
    );
  }

  return (
    <div className="qb-cart">
      <ul className="qb-cart-lines">
        {lines.map((l) => (
          <li key={l.variantId} className="qb-cart-line">
            {l.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={l.image} alt="" loading="lazy" />
            ) : (
              <span className="qb-media-placeholder" aria-hidden="true" />
            )}
            <div className="qb-cart-line-info">
              <a href={`/products/${l.productSlug}`}>{l.title}</a>
              {l.variantName && l.variantName !== "Default" && l.variantName !== l.title ? <span className="qb-muted qb-small">{l.variantName}</span> : null}
              <span className="qb-small">{fmt.format(Number(l.unitPrice))}</span>
            </div>
            <label className="qb-qty" data-size="sm">
              <span className="qb-sr-only">{labels.quantity}</span>
              <button type="button" aria-label="−" onClick={() => cart.setQuantity(l.variantId, l.quantity - 1)}>
                −
              </button>
              <input type="number" min={0} max={MAX_LINE_QUANTITY} value={l.quantity} onChange={(e) => cart.setQuantity(l.variantId, Number(e.target.value))} />
              <button type="button" aria-label="+" onClick={() => cart.setQuantity(l.variantId, l.quantity + 1)} disabled={l.quantity >= MAX_LINE_QUANTITY}>
                +
              </button>
            </label>
            <strong className="qb-cart-line-total">{fmt.format(Number(l.unitPrice) * l.quantity)}</strong>
            <button type="button" className="qb-cart-remove" onClick={() => cart.remove(l.variantId)}>
              {labels.remove}
            </button>
          </li>
        ))}
      </ul>
      <div className="qb-cart-summary">
        <p className="qb-cart-subtotal">
          <span>{labels.subtotal}</span>
          <strong>{fmt.format(subtotal)}</strong>
        </p>
        {labels.note ? <p className="qb-muted qb-small">{labels.note}</p> : null}
        <button type="button" className="qb-button" data-emphasis="primary" disabled={busy} onClick={checkout}>
          {busy ? labels.redirecting : labels.checkout}
        </button>
        {error ? (
          <p className="qb-cart-error" role="alert">
            {error}
          </p>
        ) : null}
        <a className="qb-small" href={labels.continueHref}>
          {labels.continueLabel}
        </a>
      </div>
    </div>
  );
}

/** Empties the cart once (checkout success page). */
export function ClearCart({ siteId }: { siteId: string }) {
  const { clear } = useCart(siteId);
  useEffect(() => clear(), []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
