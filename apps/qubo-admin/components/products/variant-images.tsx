"use client";

import { useState, useTransition } from "react";
import { Check, ImagePlus, Loader2 } from "lucide-react";
import { cn } from "@qubo/shared/utils";
import { setVariantImagesAction } from "@/app/product-actions";
import { ProductThumb } from "@/components/products/product-thumb";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type GalleryPhoto = { id: string; src: string; alt: string };

/** A variant's photos, picked from its product's gallery. Saves on each click. */
export function VariantImages({ site, variantId, variantName, gallery, initial }: { site: string; variantId: string; variantName: string; gallery: GalleryPhoto[]; initial: string[] }) {
  const [selected, setSelected] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, start] = useTransition();
  const chosen = gallery.filter((g) => selected.includes(g.id));

  const toggle = (id: string) => {
    const prev = selected;
    // Keep gallery order so the first chosen photo is the variant's main one.
    const next = gallery.map((g) => g.id).filter((g) => (g === id ? !prev.includes(id) : prev.includes(g)));
    setSelected(next);
    setError(null);
    start(async () => {
      const res = await setVariantImagesAction({ site, variantId, imageIds: next });
      if (res?.error) {
        setSelected(prev);
        setError(res.error);
      }
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="flex items-center gap-1 rounded-md p-0.5 hover:bg-accent/60" aria-label={`Photos of ${variantName}`}>
          {chosen.length ? (
            <>
              {chosen.slice(0, 3).map((g) => (
                <span key={g.id} className="size-7 overflow-hidden rounded border bg-white">
                  <ProductThumb src={g.src} alt={g.alt} />
                </span>
              ))}
              {chosen.length > 3 && <span className="text-[11px] text-muted-foreground">+{chosen.length - 3}</span>}
            </>
          ) : (
            <span className="flex items-center gap-1 px-1 text-xs text-muted-foreground">
              <ImagePlus className="size-3.5" /> Product photos
            </span>
          )}
          {saving && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <p className="text-xs font-medium">Photos of {variantName}</p>
        <p className="mb-2 text-xs text-muted-foreground">
          {gallery.length ? "Pick from the product gallery. None picked: the variant shows the product photos." : "Add photos to the product gallery first."}
        </p>
        <ul className="grid grid-cols-4 gap-1.5">
          {gallery.map((g) => {
            const on = selected.includes(g.id);
            return (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => toggle(g.id)}
                  aria-pressed={on}
                  aria-label={g.alt || "Product photo"}
                  className={cn("relative block aspect-square w-full overflow-hidden rounded-md border bg-white p-0.5", on && "ring-2 ring-primary")}
                >
                  <ProductThumb src={g.src} alt={g.alt} className="rounded" />
                  {on && (
                    <span className="absolute top-0.5 right-0.5 grid size-4 place-items-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-2.5" />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </PopoverContent>
    </Popover>
  );
}
