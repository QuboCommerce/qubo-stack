"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, MoreHorizontal, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@qubo/shared/utils";
import { addLocale, removeLocale, setPrimaryLocale, toggleLocalePublished } from "@/app/settings-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LocaleMark } from "./locale-mark";

type Action = (fd: FormData) => Promise<void>;

function useRun() {
  const [pending, start] = useTransition();
  const run = (action: Action, fields: Record<string, string>, done: string, after?: () => void) =>
    start(async () => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(fields)) fd.set(k, v);
      try {
        await action(fd);
        toast.success(done);
        after?.();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  return [pending, run] as const;
}

export function LanguageRowActions({ site, locale, label, published, canManage }: { site: string; locale: string; label: string; published: boolean; canManage: boolean }) {
  const [pending, run] = useRun();
  const [confirm, setConfirm] = useState<"primary" | "remove" | null>(null);
  const fields = { site, locale };

  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant={published ? "ghost" : "outline"}
        disabled={!canManage || pending}
        onClick={() => run(toggleLocalePublished, { ...fields, publish: String(!published) }, published ? `${label} unpublished` : `${label} published`)}
      >
        {pending && !confirm && <Loader2 className="animate-spin" />}
        {published ? "Unpublish" : "Publish"}
      </Button>
      {canManage && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="size-8" aria-label={`Actions for ${label}`}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={() => setConfirm("primary")}>
              <Star className="size-4" /> Make primary
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirm("remove")}>
              <Trash2 className="size-4" /> Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Dialog open={confirm !== null} onOpenChange={(o) => !pending && !o && setConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirm === "remove" ? `Remove ${label}?` : `Make ${label} the primary language?`}</DialogTitle>
            <DialogDescription>
              {confirm === "remove"
                ? "It disappears from the site. Its translations are kept and come back if you add the language again."
                : "New content is written in this language first and other languages are compared against it. The current primary language stays as a regular language."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={pending}>Cancel</Button>
            </DialogClose>
            <Button
              variant={confirm === "remove" ? "destructive" : "default"}
              disabled={pending}
              onClick={() =>
                confirm === "remove"
                  ? run(removeLocale, fields, `${label} removed`, () => setConfirm(null))
                  : run(setPrimaryLocale, fields, `${label} is now the primary language`, () => setConfirm(null))
              }
            >
              {pending && <Loader2 className="animate-spin" />}
              {confirm === "remove" ? "Remove language" : "Make primary"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AddLanguage({ site, available }: { site: string; available: { locale: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [pending, run] = useRun();
  const choice = available.find((a) => a.locale === picked);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setPicked(null);
          setOpen(true);
        }}
        className="flex w-full items-center gap-2 px-4 py-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground sm:px-5"
      >
        <Plus className="size-4" /> Add language
      </button>
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a language</DialogTitle>
            <DialogDescription>It starts unpublished, so you can translate before anyone sees it.</DialogDescription>
          </DialogHeader>
          <div role="radiogroup" aria-label="Language" className="grid gap-1.5">
            {available.map((a) => {
              const on = a.locale === picked;
              return (
                <button
                  key={a.locale}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPicked(a.locale)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                    on ? "border-primary bg-primary/5" : "hover:bg-muted/60",
                  )}
                >
                  <LocaleMark locale={a.locale} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{a.label}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{a.locale}</span>
                  </span>
                  <Check className={cn("size-4 text-primary", !on && "invisible")} />
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={pending}>Cancel</Button>
            </DialogClose>
            <Button disabled={!choice || pending} onClick={() => choice && run(addLocale, { site, locale: choice.locale }, `${choice.label} added`, () => setOpen(false))}>
              {pending && <Loader2 className="animate-spin" />}
              Add {choice?.label ?? "language"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
