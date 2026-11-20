"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { FilePlus2, Lock, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, RadioCard, TextInput } from "@/components/settings/controls";
import { createPageAction } from "@/app/page-actions";
import type { ActionState } from "@/lib/action-state";
import { blueprintIcon } from "./blueprint-icon";

/** Serializable view of a blueprint suggestion for one site (functions stay on the server). */
export type PageSuggestion = {
  id: string;
  category: string;
  categoryLabel: string;
  icon: string;
  title: string;
  slug: string;
  description: string;
  /** Module labels the site lacks; non-empty disables the card. */
  missing: string[];
  exists: boolean;
};

export const slugify = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9/]+/g, "-")
    .replace(/^[-/]+|[-/]+$/g, "");

const BLANK = "";

export function CreatePageDialog({
  site,
  suggestions,
  settingsHref,
  open,
  onOpenChange,
  initial,
}: {
  site: string;
  suggestions: PageSuggestion[];
  settingsHref: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Blueprint id to preselect; "" for a blank page. */
  initial?: string;
}) {
  const t = useTranslations("onlineStore.pages.create");
  const tc = useTranslations("common");
  const locale = useLocale();
  const list = new Intl.ListFormat(locale, { type: "conjunction" });
  const [state, action, pending] = useActionState<ActionState, FormData>(createPageAction, null);
  const [choice, setChoice] = useState(initial ?? BLANK);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const available = useMemo(() => suggestions.filter((s) => !s.exists), [suggestions]);
  const selected = available.find((s) => s.id === choice);

  useEffect(() => {
    if (!open) return;
    const next = initial ?? BLANK;
    const bp = available.find((s) => s.id === next);
    setChoice(next);
    setTitle(bp?.title ?? "");
    setSlug(bp?.slug ?? "");
    setSlugTouched(false);
  }, [open, initial]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (id: string) => {
    const bp = available.find((s) => s.id === id);
    setChoice(id);
    setTitle(bp?.title ?? "");
    setSlug(bp?.slug ?? "");
    setSlugTouched(false);
  };
  const onTitle = (v: string) => {
    setTitle(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <form action={action} className="grid gap-5">
          <input type="hidden" name="site" value={site} />
          <input type="hidden" name="blueprint" value={choice} />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FilePlus2 className="size-4" /> {t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[40vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
            <RadioCard
              name="choice"
              value={BLANK}
              checked={choice === BLANK}
              onChange={() => pick(BLANK)}
              title={t("blank")}
              description={t("blankDescription")}
              icon={<Plus className="size-4" />}
            />
            {available.map((s) => {
              const Icon = blueprintIcon(s.icon);
              const locked = s.missing.length > 0;
              return (
                <RadioCard
                  key={s.id}
                  name="choice"
                  value={s.id}
                  checked={choice === s.id}
                  onChange={() => !locked && pick(s.id)}
                  title={s.title}
                  description={s.description}
                  icon={locked ? <Lock className="size-4" /> : <Icon className="size-4" />}
                  footer={
                    locked ? (
                      <span className="text-xs text-muted-foreground">
                        {t("needsModule", { modules: list.format(s.missing) })}{" "}
                        <a href={settingsHref} className="underline underline-offset-2">{t("switchOn")}</a>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">/{s.slug}</span>
                    )
                  }
                />
              );
            })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("fields.title")} htmlFor="page-title">
              <TextInput id="page-title" name="title" required minLength={1} value={title} onChange={(e) => onTitle(e.target.value)} placeholder={selected?.title ?? t("fields.titlePlaceholder")} />
            </Field>
            <Field label={t("fields.url")} hint={`/${slug || "..."}`} htmlFor="page-slug">
              <TextInput
                id="page-slug"
                name="slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                onBlur={() => setSlug(slugify(slug))}
                placeholder={selected?.slug ?? t("fields.urlPlaceholder")}
              />
            </Field>
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost">{tc("cancel")}</Button></DialogClose>
            <Button type="submit" disabled={pending || !title.trim()}>{pending ? t("creating") : t("submit")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
