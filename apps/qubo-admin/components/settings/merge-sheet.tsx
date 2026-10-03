"use client";

import { useState } from "react";
import { GitMerge } from "lucide-react";
import type { Conflict } from "@/lib/merge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@qubo/shared/utils";

type Pick = "mine" | "theirs";

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
  noun: string;
  onCancel: () => void;
  onResolve: (choices: Record<string, Pick>) => void;
}) {
  const [choices, setChoices] = useState<Record<string, Pick>>(() => Object.fromEntries(conflict.fields.map((f) => [f.name, "mine" as Pick])));
  const who = conflict.by ?? "Someone";
  const nothing = !conflict.fields.length && !conflict.auto.length;

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="size-4" />
            {conflict.fields.length ? "Both of you changed this" : "Merge changes"}
          </DialogTitle>
          <DialogDescription>
            {nothing
              ? `This ${noun} is up to date. Saving keeps all your edits.`
              : `${who} saved this ${noun} while you were editing. ${conflict.fields.length ? "Pick which version to keep for each field." : "None of their changes touch your edits."}`}
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
                        <span className="block text-xs font-medium text-muted-foreground">{side === "mine" ? "Keep mine" : `Use ${who}'s`}</span>
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
            Also keeping {who}&apos;s changes to {conflict.auto.join(", ")}.
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => onResolve(choices)}>Save merged</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
