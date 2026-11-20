"use client";

import { X } from "lucide-react";
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
  title = "Media",
  ...options
}: QuickPickOptions & { open: boolean; onOpenChange: (open: boolean) => void; onPick: (items: MediaItem[]) => void; title?: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="flex h-[min(88vh,52rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,72rem)]">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <DialogTitle className="text-base">{title}</DialogTitle>
            <DialogDescription className="text-xs">Pick from the library, or drop, paste and upload new files.</DialogDescription>
          </div>
          <button type="button" onClick={() => onOpenChange(false)} aria-label="Close" className="text-muted-foreground hover:text-foreground">
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
