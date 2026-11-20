"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, ImagePlus, Loader2 } from "lucide-react";
import { cn } from "@qubo/shared/utils";
import { listProductCardsAction, type ProductCardPage } from "@/app/media-actions";
import { productGalleryAction, type GalleryImage } from "@/app/product-actions";
import { ProductMedia } from "@/components/products/product-media";
import { ProductThumb } from "@/components/products/product-thumb";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type Card = ProductCardPage["cards"][number];

/**
 * Products lens: one card per product. The tall top strip (the "forehead")
 * carries the reference and opens the product's gallery, which is the same
 * ProductMedia the product editor uses, so both write the same rows.
 */
export function ProductCards({ site, siteId, query, missing }: { site: string; siteId: string; query: string; missing: boolean }) {
  const t = useTranslations("media.products");
  const [cards, setCards] = useState<Card[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Card | null>(null);
  const request = useRef(0);

  const load = useCallback(
    async (offset: number) => {
      const n = ++request.current;
      setLoading(true);
      try {
        const page = await listProductCardsAction({ site, q: query || undefined, missing: missing || undefined, offset });
        if (n !== request.current) return;
        setCards((prev) => (offset ? [...prev, ...page.cards] : page.cards));
        setMore(page.more);
      } finally {
        if (n === request.current) setLoading(false);
      }
    },
    [site, query, missing],
  );

  useEffect(() => {
    void load(0);
  }, [load]);

  return (
    <>
      {!loading && !cards.length ? (
        <p className="grid min-h-60 place-items-center text-center text-sm text-muted-foreground">
          {query ? t("emptySearch") : missing ? t("emptyMissing") : t("empty")}
        </p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3" aria-label={t("list")}>
          {cards.map((card) => (
            <ProductCardItem key={card.id} card={card} onOpen={() => setOpen(card)} />
          ))}
        </ul>
      )}
      {loading && <Loader2 className="mx-auto mt-4 size-5 animate-spin text-muted-foreground" />}
      {more && !loading && (
        <div className="mt-3 text-center">
          <Button type="button" variant="outline" size="sm" onClick={() => void load(cards.length)}>
            {t("loadMore")}
          </Button>
        </div>
      )}
      <GallerySheet
        site={site}
        siteId={siteId}
        card={open}
        onClose={() => setOpen(null)}
        onChange={(id, images) =>
          setCards((prev) =>
            prev.map((c) =>
              c.id === id ? { ...c, imageCount: images.length, images: images.slice(0, 4).map((i) => ({ url: i.url, alt: i.alt, src: i.src, linked: i.url.includes("/api/media/") })) } : c,
            ),
          )
        }
      />
    </>
  );
}

function ProductCardItem({ card, onOpen }: { card: Card; onOpen: () => void }) {
  const t = useTranslations("media.products");
  const shown = card.images.slice(0, 3);
  const extra = card.imageCount - shown.length;
  return (
    <li className={cn("overflow-hidden rounded-xl border bg-card shadow-xs", card.imageCount === 0 && "border-dashed")}>
      <button type="button" onClick={onOpen} className="block w-full px-3 pt-3 pb-5 text-left transition-colors hover:bg-accent/40" aria-label={t("openPhotos", { name: card.name })}>
        <span className="flex min-h-5 flex-wrap items-center gap-1">
          {card.refs.length > 0 ? (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-primary">{card.refs[0]}</span>
          ) : (
            <span className="text-[11px] text-muted-foreground">{t("noReference")}</span>
          )}
          {card.refs.length > 1 && <span className="text-[11px] text-muted-foreground">+{card.refs.length - 1}</span>}
          {card.archived && <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{t("archived")}</span>}
        </span>
        <span className="mt-1.5 line-clamp-2 block text-sm leading-snug font-medium">{card.name}</span>
      </button>
      <div className="px-3 pb-3">
        {card.imageCount === 0 ? (
          <button type="button" onClick={onOpen} className="flex h-20 w-full items-center justify-center gap-2 rounded-lg border border-dashed text-xs text-muted-foreground hover:bg-accent/40">
            <ImagePlus className="size-4" /> {t("noPhotos")}
          </button>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {shown.map((img, i) => (
              <button key={`${img.url}-${i}`} type="button" onClick={onOpen} tabIndex={-1} className="relative aspect-square overflow-hidden rounded-md border bg-white p-0.5">
                <ProductThumb src={img.src} alt={img.alt} className="rounded" />
                {i === shown.length - 1 && extra > 0 && (
                  <span className="absolute inset-0 grid place-items-center bg-black/45 text-sm font-medium text-white">+{extra}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

function GallerySheet({
  site,
  siteId,
  card,
  onClose,
  onChange,
}: {
  site: string;
  siteId: string;
  card: Card | null;
  onClose: () => void;
  onChange: (productId: string, images: GalleryImage[]) => void;
}) {
  const t = useTranslations("media.products");
  const [gallery, setGallery] = useState<{ id: string; images: GalleryImage[] } | { id: string; missing: true } | null>(null);

  useEffect(() => {
    if (!card) return;
    let live = true;
    setGallery(null);
    productGalleryAction({ site, productId: card.id })
      .then((g) => live && setGallery(g ? { id: card.id, images: g.images } : { id: card.id, missing: true }))
      .catch(() => live && setGallery({ id: card.id, missing: true }));
    return () => {
      live = false;
    };
  }, [site, card]);

  return (
    <Sheet open={!!card} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <div className="flex flex-wrap gap-1">
            {card?.refs.map((r) => (
              <span key={r} className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-primary">
                {r}
              </span>
            ))}
          </div>
          <SheetTitle className="text-base">{card?.name}</SheetTitle>
          <SheetDescription className="text-xs">{t("galleryDescription")}</SheetDescription>
        </SheetHeader>
        <div className="@container min-h-0 flex-1 overflow-y-auto p-4">
          {card && gallery?.id === card.id && "missing" in gallery ? (
            <p className="mt-8 text-center text-sm text-muted-foreground">{t("notLoaded")}</p>
          ) : card && gallery?.id === card.id && "images" in gallery ? (
            <ProductMedia key={card.id} site={site} siteId={siteId} productId={card.id} initial={gallery.images} onChange={(images) => onChange(card.id, images)} />
          ) : (
            <Loader2 className="mx-auto mt-8 size-5 animate-spin text-muted-foreground" />
          )}
        </div>
        {card && (
          <div className="border-t p-4">
            <Button asChild variant="outline" size="sm">
              <Link href={`/${site}/products/${card.id}`}>
                <ExternalLink className="size-4" /> {t("openEditor")}
              </Link>
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
