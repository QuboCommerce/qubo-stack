"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MediaItem } from "@qubo/storage/media";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { MediaBrowser, type QuickPickOptions } from "./browser";

export { MediaBrowser, type QuickPickOptions } from "./browser";
export { Thumb } from "./thumb";

/** The library as a picker in a dialog. Opens on the `lens` of the thing being edited. */
export function QuickPick({
  open,
  onOpenChange,
  onPick,
  title,
  ...options
}: QuickPickOptions & { open: boolean; onOpenChange: (open: boolean) => void; onPick: (items: MediaItem[]) => void; title?: string }) {
  const t = useTranslations("media.quickPick");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="flex h-[min(88vh,52rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,72rem)]">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <DialogTitle className="text-base">{title ?? t("title")}</DialogTitle>
            <DialogDescription className="text-xs">{t("description")}</DialogDescription>
          </div>
          <button type="button" onClick={() => onOpenChange(false)} aria-label={t("close")} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        {open && (
          <MediaBrowser
            {...options}
            className="min-h-0 flex-1"
            onCancel={() => onOpenChange(false)}
            onPick={(items) => {
              onPick(items);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
