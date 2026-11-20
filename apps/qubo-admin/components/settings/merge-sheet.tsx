"use client";

import { useState } from "react";
import { GitMerge } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Conflict } from "@/lib/merge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@qubo/shared/utils";

type Pick = "mine" | "theirs";

export type MergeNoun = "page" | "product" | "category" | "collection" | "code" | "site" | "settings";

/**
 * Field-level merge: one row per field both sides changed, "Keep mine" by
 * default. Fields only they changed are listed and kept without asking.
 */
export function MergeSheet({
  conflict,
  noun,
  onCancel,
  onResolve,
}: {
  conflict: Conflict;
  noun: MergeNoun;
  onCancel: () => void;
  onResolve: (choices: Record<string, Pick>) => void;
}) {
  const [choices, setChoices] = useState<Record<string, Pick>>(() => Object.fromEntries(conflict.fields.map((f) => [f.name, "mine" as Pick])));
  const t = useTranslations("settings.merge");
  const tCommon = useTranslations("common");
  const tNouns = useTranslations("settings.nouns");
  const who = conflict.by ?? t("someone");
  const thisNoun = tNouns(noun);
  const nothing = !conflict.fields.length && !conflict.auto.length;

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="size-4" />
            {conflict.fields.length ? t("titleConflict") : t("title")}
          </DialogTitle>
          <DialogDescription>
            {nothing
              ? t("upToDate", { noun: thisNoun })
              : `${t("savedWhileEditing", { who, noun: thisNoun })} ${conflict.fields.length ? t("pickVersion") : t("noOverlap")}`}
          </DialogDescription>
        </DialogHeader>

        {conflict.fields.length > 0 && (
          <ul className="space-y-4">
            {conflict.fields.map((f) => (
              <li key={f.name} className="space-y-1.5">
                <p className="text-[13px] font-medium">{f.label}</p>
                <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={f.label}>
                  {(["mine", "theirs"] as const).map((side) => {
                    const on = choices[f.name] === side;
                    return (
                      <button
                        key={side}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setChoices((c) => ({ ...c, [f.name]: side }))}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-left text-[13px] transition-colors",
                          on ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/60",
                        )}
                      >
                        <span className="block text-xs font-medium text-muted-foreground">{side === "mine" ? t("keepMine") : t("useTheirs", { who })}</span>
                        <span className="mt-0.5 line-clamp-4 block whitespace-pre-wrap break-words">{side === "mine" ? f.mineText : f.theirsText}</span>
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}

        {conflict.auto.length > 0 && (
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            {t("alsoKeeping", { who, fields: conflict.auto.join(", ") })}
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>{tCommon("cancel")}</Button>
          <Button onClick={() => onResolve(choices)}>{t("saveMerged")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
