"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Lock } from "lucide-react";
import type { ViewIndex } from "@peltier/studio";
import { cn } from "@peltier/shared/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { viewIcons } from "@/lib/view-meta";

type Entry = ViewIndex["groups"][number]["entries"][number];

const iconOf = (e: Entry) => viewIcons[e.resourceKind ?? e.key.split(":")[1] ?? ""] ?? viewIcons.page!;

/**
 * Shopify's "Home page ▾": jump between templates, pages and section groups
 * without leaving the editor. Searchable; system views carry a lock.
 */
export function ViewPicker({ index, current, onSelect }: { index: ViewIndex; current: Entry; onSelect: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  const Icon = iconOf(current);

  const item = (e: Entry) => {
    const I = iconOf(e);
    return (
      <CommandItem
        key={e.key}
        value={`${e.label} ${e.description ?? ""} ${e.key}`}
        onSelect={() => {
          setOpen(false);
          if (e.key !== current.key) onSelect(e.key);
        }}
        className="gap-2.5"
      >
        <I className="size-4 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">
          {e.label}
          {e.description && <span className="ml-1.5 text-xs text-muted-foreground">{e.description}</span>}
        </span>
        {e.hasUnpublishedChanges && <span className="size-1.5 rounded-full bg-amber-500" title="Unpublished changes" />}
        {e.isSystem && e.resourceKind && <Lock className="size-3 text-muted-foreground" aria-label="System page" />}
        <Check className={cn("size-3.5", e.key === current.key ? "opacity-100" : "opacity-0")} />
      </CommandItem>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group flex h-8 min-w-0 max-w-full items-center gap-2 rounded-lg border bg-background px-2.5 text-sm font-medium shadow-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-w-56"
          aria-label={`Editing ${current.label}. Change view`}
        >
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-left">{current.label}</span>
          {current.isSystem && current.resourceKind && <Lock className="size-3 shrink-0 text-muted-foreground" />}
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(22rem,calc(100vw-1rem))] p-0" align="center">
        <Command>
          <CommandInput placeholder="Search templates and pages…" />
          <CommandList className="max-h-[min(28rem,70vh)]">
            <CommandEmpty>No matching view.</CommandEmpty>
            {index.groups.map((g) => (
              <CommandGroup key={g.id} heading={g.label}>
                {g.entries.map(item)}
              </CommandGroup>
            ))}
            {index.sectionGroups.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Shared sections">{index.sectionGroups.map(item)}</CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
