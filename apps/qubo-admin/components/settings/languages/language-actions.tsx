"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, MoreHorizontal, Plus, Star, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@qubo/shared/utils";
import { addLocale, removeLocale, setPrimaryLocale, toggleLocalePublished } from "@/app/settings-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LocaleMark } from "./locale-mark";

type Action = (fd: FormData) => Promise<void>;

function useRun() {
  const t = useTranslations("settings.languages");
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
        toast.error(e instanceof Error ? e.message : t("actions.generic"));
      }
    });
  return [pending, run] as const;
}

export function LanguageRowActions({ site, locale, label, published, canManage }: { site: string; locale: string; label: string; published: boolean; canManage: boolean }) {
  const t = useTranslations("settings.languages");
  const tc = useTranslations("common");
  const [pending, run] = useRun();
  const [confirm, setConfirm] = useState<"primary" | "remove" | null>(null);
  const fields = { site, locale };

  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant={published ? "ghost" : "outline"}
        disabled={!canManage || pending}
        onClick={() => run(toggleLocalePublished, { ...fields, publish: String(!published) }, published ? t("actions.unpublished", { label }) : t("actions.published", { label }))}
      >
        {pending && !confirm && <Loader2 className="animate-spin" />}
        {published ? t("unpublish") : t("publish")}
      </Button>
      {canManage && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="size-8" aria-label={t("actionsFor", { label })}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={() => setConfirm("primary")}>
              <Star className="size-4" /> {t("makePrimary")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirm("remove")}>
              <Trash2 className="size-4" /> {tc("remove")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Dialog open={confirm !== null} onOpenChange={(o) => !pending && !o && setConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirm === "remove" ? t("removeTitle", { label }) : t("primaryTitle", { label })}</DialogTitle>
            <DialogDescription>
              {confirm === "remove"
                ? t("removeHelp")
                : t("primaryConfirmHelp")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={pending}>{tc("cancel")}</Button>
            </DialogClose>
            <Button
              variant={confirm === "remove" ? "destructive" : "default"}
              disabled={pending}
              onClick={() =>
                confirm === "remove"
                  ? run(removeLocale, fields, t("actions.removed", { label }), () => setConfirm(null))
                  : run(setPrimaryLocale, fields, t("actions.nowPrimary", { label }), () => setConfirm(null))
              }
            >
              {pending && <Loader2 className="animate-spin" />}
              {confirm === "remove" ? t("removeConfirm") : t("makePrimary")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AddLanguage({ site, available }: { site: string; available: { locale: string; label: string }[] }) {
  const t = useTranslations("settings.languages");
  const tc = useTranslations("common");
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
        <Plus className="size-4" /> {t("add.button")}
      </button>
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("add.title")}</DialogTitle>
            <DialogDescription>{t("add.description")}</DialogDescription>
          </DialogHeader>
          <div role="radiogroup" aria-label={t("add.label")} className="grid gap-1.5">
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
              <Button variant="outline" disabled={pending}>{tc("cancel")}</Button>
            </DialogClose>
            <Button disabled={!choice || pending} onClick={() => choice && run(addLocale, { site, locale: choice.locale }, t("actions.added", { label: choice.label }), () => setOpen(false))}>
              {pending && <Loader2 className="animate-spin" />}
              {choice ? t("add.confirm", { label: choice.label }) : t("add.confirmNone")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
