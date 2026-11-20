"use client";

import { useCallback, useState } from "react";
import { ImageOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@qubo/shared/utils";

/**
 * Product image with a quiet placeholder when there is no URL or the file fails
 * to load. The ref check catches images that failed before hydration, when
 * React's onError never fires.
 */
export function ProductThumb({ src, alt = "", label = false, className }: { src: string | null | undefined; alt?: string; label?: boolean; className?: string }) {
  const t = useTranslations("products.thumb");
  const [failed, setFailed] = useState<string | null>(null);
  const check = useCallback((el: HTMLImageElement | null) => {
    if (el && src && el.complete && el.naturalWidth === 0) setFailed(src);
  }, [src]);

  if (!src || failed === src) {
    return (
      <div className={cn("flex size-full flex-col items-center justify-center gap-1.5 rounded-[inherit] bg-muted/50 text-muted-foreground/70", className)} role="img" aria-label={alt || t("noImage")}>
        <ImageOff className={label ? "size-6" : "size-4"} strokeWidth={1.5} />
        {label && <span className="text-[11px] font-medium">{t("noImage")}</span>}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={check} src={src} alt={alt} loading="lazy" onError={() => setFailed(src)} className={cn("size-full object-contain", className)} />
  );
}
