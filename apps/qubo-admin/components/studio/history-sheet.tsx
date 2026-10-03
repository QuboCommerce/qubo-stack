"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Bookmark, History, Loader2, RotateCcw, Rocket, Undo2 } from "lucide-react";
import { toast } from "sonner";
import {
  checkpointAction,
  listRevisionsAction,
  restoreRevisionAction,
  rollbackAction,
  type RevisionItem,
} from "@/app/studio-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { relativeTime } from "@/lib/format";

type Loaded = { data: unknown; version: number; hasUnpublishedChanges: boolean };

/**
 * Publish history + named versions. "Restore" loads a revision into the draft
 * (nothing goes live); "Roll back" republishes it immediately.
 */
export function HistorySheet({
  open,
  onOpenChange,
  site,
  documentId,
  canPublish,
  beforeChange,
  onReplaced,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  site: string;
  documentId: string;
  canPublish: boolean;
  /** Persist pending edits first so nothing is lost silently. */
  beforeChange: () => Promise<boolean>;
  onReplaced: (next: Loaded) => void;
}) {
  const [items, setItems] = useState<RevisionItem[] | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      const res = await listRevisionsAction(site, documentId);
      if (res.ok) setItems(res.revisions);
      else toast.error(res.error);
    });
  }, [site, documentId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  async function saveVersion() {
    setBusy("checkpoint");
    if (!(await beforeChange())) {
      setBusy(null);
      return toast.error("Save your changes before creating a version.");
    }
    const res = await checkpointAction(site, { documentId, label: label || undefined });
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    setLabel("");
    toast.success(`Version ${res.version} saved`);
    load();
  }

  async function apply(rev: RevisionItem, mode: "restore" | "rollback") {
    if (mode === "rollback" && !window.confirm(`Put version ${rev.version} live now? Visitors will see it immediately.`)) return;
    setBusy(`${mode}:${rev.id}`);
    await beforeChange();
    const res = await (mode === "restore" ? restoreRevisionAction : rollbackAction)(site, { documentId, revisionId: rev.id });
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    onReplaced(res);
    toast.success(mode === "restore" ? `Version ${rev.version} restored to your draft` : `Rolled back to version ${rev.version}`);
    if (mode === "rollback") load();
    else onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2"><History className="size-4" /> Version history</SheetTitle>
          <SheetDescription>
            Undo/redo covers this session. Versions are kept forever: restore one into your draft, or roll the live site back.
          </SheetDescription>
        </SheetHeader>

        <div className="border-b p-4">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void saveVersion();
            }}
          >
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name this version (optional)" maxLength={120} className="bg-card" />
            <Button type="submit" variant="outline" disabled={busy === "checkpoint"}>
              {busy === "checkpoint" ? <Loader2 className="animate-spin" /> : <Bookmark />} Save version
            </Button>
          </form>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!items ? (
            <div className="flex items-center justify-center p-10 text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>
          ) : items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Nothing published yet.</p>
          ) : (
            <ol className="relative p-4">
              <span className="absolute bottom-6 left-[1.6rem] top-6 w-px bg-border" aria-hidden />
              {items.map((r) => (
                <li key={r.id} className="relative flex gap-3 py-2.5">
                  <span className={`z-10 mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border bg-background ${r.isPublished ? "border-emerald-500 text-emerald-600" : "text-muted-foreground"}`}>
                    {r.kind === "publish" ? <Rocket className="size-3" /> : <Bookmark className="size-3" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium">{r.label || (r.kind === "publish" ? "Published" : "Saved version")}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">v{r.version}</span>
                      {r.isPublished && <Badge variant="secondary" className="h-5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">Live</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground" title={new Date(r.createdAt).toLocaleString()}>
                      {relativeTime(r.createdAt)}{r.createdByName ? ` · ${r.createdByName}` : ""}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!!busy} onClick={() => apply(r, "restore")}>
                        {busy === `restore:${r.id}` ? <Loader2 className="animate-spin" /> : <Undo2 />} Restore to draft
                      </Button>
                      {canPublish && !r.isPublished && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={!!busy} onClick={() => apply(r, "rollback")}>
                          {busy === `rollback:${r.id}` ? <Loader2 className="animate-spin" /> : <RotateCcw />} Roll back live
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
