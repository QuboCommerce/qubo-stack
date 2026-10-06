"use client";

import { useState } from "react";
import { Check, Lock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/page";
import { blueprintIcon } from "./blueprint-icon";
import { CreatePageDialog, type PageSuggestion } from "./create-page-dialog";

const categoryOrder = ["company", "legal", "commerce", "utility"];

/**
 * "Suggested pages": blueprints the site's modules call for, grouped by
 * category. Owns the Create page dialog so a card can open it preselected.
 */
export function SuggestedPages({ site, suggestions, settingsHref, children }: { site: string; suggestions: PageSuggestion[]; settingsHref: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState<string>("");
  const show = (id: string) => {
    setInitial(id);
    setOpen(true);
  };
  const groups = categoryOrder
    .map((c) => ({ id: c, label: suggestions.find((s) => s.category === c)?.categoryLabel ?? c, items: suggestions.filter((s) => s.category === c) }))
    .filter((g) => g.items.length);

  return (
    <>
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={() => show("")}><Plus /> New page</Button>
      </div>
      {children}
      <Panel title="Suggested pages" description="Pages a site like yours usually has. Nothing is forced: add the ones you want, skip the rest." flush>
        <div className="mt-1 border-t">
          {groups.map((g) => (
            <div key={g.id}>
              <p className="bg-muted/40 px-4 py-1.5 text-xs font-medium text-muted-foreground sm:px-5">{g.label}</p>
              <ul className="divide-y">
                {g.items.map((s) => {
                  const Icon = blueprintIcon(s.icon);
                  const locked = s.missing.length > 0;
                  return (
                    <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-sm sm:px-5">
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-x-2 font-medium">
                          {s.title}
                          <span className="font-normal text-muted-foreground">/{s.slug}</span>
                        </p>
                        <p className="line-clamp-2 text-xs text-muted-foreground">{s.description}</p>
                      </div>
                      {s.exists ? (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground"><Check className="size-3.5" /> Added</span>
                      ) : locked ? (
                        <Button variant="outline" size="sm" asChild>
                          <a href={settingsHref} title={`Needs the ${s.missing.join(" and ")} module`}><Lock /> Needs {s.missing.join(" and ")}</a>
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => show(s.id)}><Plus /> Add</Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </Panel>
      <CreatePageDialog site={site} suggestions={suggestions} settingsHref={settingsHref} open={open} onOpenChange={setOpen} initial={initial} />
    </>
  );
}
