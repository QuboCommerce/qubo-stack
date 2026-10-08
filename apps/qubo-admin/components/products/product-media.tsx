"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@qubo/shared/utils";
import { setProductImagesAction } from "@/app/product-actions";
import { QuickPick } from "@/components/media/quick-pick";
import { Button } from "@/components/ui/button";

type Image = { url: string; alt: string; src: string };

/** Product gallery: pick from the media library, reorder, remove. Saves immediately. */
export function ProductMedia({ site, siteId, productId, initial }: { site: string; siteId: string; productId: string; initial: Image[] }) {
  const [images, setImages] = useState(initial);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, start] = useTransition();

  const commit = (next: Image[]) => {
    const prev = images;
    setImages(next);
    setError(null);
    start(async () => {
      const res = await setProductImagesAction({ site, productId, images: next.map(({ url, alt }) => ({ url, alt })) });
      if (res?.error) {
        setImages(prev);
        setError(res.error);
      }
    });
  };

  const move = (i: number, by: -1 | 1) => {
    const next = [...images];
    const [img] = next.splice(i, 1);
    next.splice(i + by, 0, img!);
    commit(next);
  };

  return (
    <div className="space-y-2">
      <ul className="grid grid-cols-3 gap-2 @min-[40rem]:grid-cols-5 @min-[80rem]:grid-cols-7">
        {images.map((img, i) => (
          <li key={`${img.url}-${i}`} className={cn("group relative", i === 0 && "col-span-2 row-span-2")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.src} alt={img.alt} className="aspect-square size-full rounded-lg border bg-white object-contain p-1" />
            <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
              <span className="flex gap-1">
                {i > 0 && (
                  <Button type="button" size="icon" variant="secondary" className="size-6" onClick={() => move(i, -1)} aria-label={i === 1 ? "Make main image" : "Move left"}>
                    <ArrowLeft className="size-3" />
                  </Button>
                )}
                {i < images.length - 1 && (
                  <Button type="button" size="icon" variant="secondary" className="size-6" onClick={() => move(i, 1)} aria-label="Move right">
                    <ArrowRight className="size-3" />
                  </Button>
                )}
              </span>
              <Button type="button" size="icon" variant="secondary" className="size-6" onClick={() => commit(images.filter((_, j) => j !== i))} aria-label="Remove image">
                <X className="size-3" />
              </Button>
            </div>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground hover:bg-accent/40"
          >
            {saving ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
            Add images
          </button>
        </li>
      </ul>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <QuickPick
        open={open}
        onOpenChange={setOpen}
        site={site}
        siteId={siteId}
        kind="image"
        multiple
        title="Product images"
        onPick={(picked) => commit([...images, ...picked.filter((p) => !images.some((i) => i.url === p.url)).map((p) => ({ url: p.url, alt: p.alt, src: p.url }))])}
      />
    </div>
  );
}
