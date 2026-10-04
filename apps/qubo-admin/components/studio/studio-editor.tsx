"use client";

import "@puckeditor/core/puck.css";
import "./studio.css";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Puck, createUsePuck, useGetPuck, type Config, type Data } from "@puckeditor/core";
import { instantiate, registry, type Capability, type DocumentData, type SiteType } from "@qubo/blocks";
import { createEditorConfig } from "@qubo/blocks/editor";
import type { Theme } from "@qubo/stylekit";
import type { ViewIndex } from "@qubo/studio";
import {
  AlertTriangle,
  Blocks,
  Check,
  Eye,
  CloudOff,
  History,
  Laptop,
  Layers,
  Loader2,
  Monitor,
  Moon,
  Paintbrush,
  MoreHorizontal,
  PanelLeft,
  Plus,
  Redo2,
  Rocket,
  Smartphone,
  SlidersHorizontal,
  Sun,
  Tablet,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@qubo/shared/utils";
import type { SectionEntry } from "@/lib/section-catalog";
import { AddSectionDialog } from "./add-section-dialog";
import { mediaFieldAdapter } from "./media-field";
import { discardDraftAction, loadDraftAction, publishAction } from "@/app/studio-actions";
import { loadThemeAction, publishThemeAction } from "@/app/theme-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { relativeTime } from "@/lib/format";
import { studioHref } from "@/lib/view-meta";
import { HistorySheet } from "./history-sheet";
import { useReportPresence } from "@qubo/realtime/client";
import { BlockPresenceOverlay, DocumentPresence } from "@/components/presence";
import { useDocumentSync, type DocumentSync } from "./use-document-sync";
import { useLiveCanvas, useStudioLease, type StudioLease } from "./use-studio-lease";
import { peerColor } from "@/components/presence";
import { ViewPicker } from "./view-picker";
import { ThemePanel } from "./theme/theme-panel";
import { useThemeEditor, type ThemeEditor, type ThemeRecord } from "./theme/use-theme-editor";

type ViewEntry = ViewIndex["groups"][number]["entries"][number];

export type StudioEditorProps = {
  site: { id: string; slug: string; name: string; type: SiteType; capabilities: Capability[] };
  index: ViewIndex;
  view: ViewEntry;
  document: { id: string; data: DocumentData; version: number; hasUnpublishedChanges: boolean };
  theme: Theme | null;
  /** The active theme's editable draft (null when the site has no theme). */
  themeRecord: ThemeRecord | null;
  audience: "merchant" | "builder";
  canPublish: boolean;
  locale: string;
};

const usePuck = createUsePuck();
const readOnlyPermissions = { drag: false, duplicate: false, delete: false, edit: false, insert: false };
const editPermissions = { drag: true, duplicate: true, delete: true, edit: true, insert: true };
const ROOT_ZONE = "root:default-zone";

// ------------------------------------------------------------ breakpoints ---

function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => true,
  );
}

type Viewport = "fit" | "desktop" | "tablet" | "mobile";
const viewports: { id: Viewport; label: string; width: number | null; icon: typeof Monitor }[] = [
  { id: "fit", label: "Fit to window", width: null, icon: Monitor },
  { id: "desktop", label: "Desktop · 1280", width: 1280, icon: Laptop },
  { id: "tablet", label: "Tablet · 768", width: 768, icon: Tablet },
  { id: "mobile", label: "Mobile · 390", width: 390, icon: Smartphone },
];

// ----------------------------------------------------------------- editor ---

export function StudioEditor(props: StudioEditorProps) {
  const { site, document: doc, audience } = props;
  const [editor, setEditor] = useState({ key: 0, data: doc.data });
  const [mode, setMode] = useState<"light" | "dark">("light");
  const themeEditor = useThemeEditor(site.slug, props.themeRecord);
  // The canvas previews the theme draft live; deferring keeps sliders responsive.
  const theme = useDeferredValue(themeEditor.theme ?? props.theme);
  // Field options (scheme/button pickers) only change when those lists do.
  const fieldThemeKey = theme
    ? JSON.stringify([theme.schemes.map((s) => [s.id, s.name]), theme.buttons.map((b) => [b.id, b.name]), theme.defaultScheme, theme.defaultButton])
    : "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fieldTheme = useMemo(() => theme, [fieldThemeKey]);
  const sync = useDocumentSync({
    site: site.slug,
    documentId: doc.id,
    version: doc.version,
    hasUnpublishedChanges: doc.hasUnpublishedChanges,
    initialData: doc.data,
  });

  const config = useMemo(
    () =>
      createEditorConfig(registry, {
        capabilities: site.capabilities,
        fieldContext: { theme: fieldTheme ?? undefined, audience },
        adapters: { media: mediaFieldAdapter({ slug: site.slug, id: site.id }) },
      }) as Config,
    [site.capabilities, site.slug, site.id, fieldTheme, audience],
  );

  const metadata = useMemo(
    () => ({
      theme: theme ?? undefined,
      mode,
      locale: props.locale,
      site: { id: site.id, type: site.type, capabilities: site.capabilities, name: site.name },
      data: {},
    }),
    [theme, mode, props.locale, site],
  );

  // One editing tab per document; everyone else follows live (read-only).
  const lease = useStudioLease({ siteId: site.id, documentId: doc.id, onLost: () => void sync.flush() });
  const following = lease.role === "follower";
  const followingRef = useRef(following);
  followingRef.current = following;
  const pushRef = useRef<(data: unknown) => void>(() => {});
  const { markActive } = lease;
  const onChange = useCallback(
    (data: unknown) => {
      if (followingRef.current) return;
      sync.onChange(data);
      pushRef.current(data);
      markActive();
    },
    [sync, markActive],
  );

  const replace = useCallback(
    (next: { data: unknown; version: number; hasUnpublishedChanges: boolean }) => {
      sync.reset(next.data, next.version, next.hasUnpublishedChanges);
      // Remount: the editor starts a fresh undo history on the new content.
      setEditor((e) => ({ key: e.key + 1, data: next.data as DocumentData }));
    },
    [sync],
  );

  return (
    <TooltipProvider delayDuration={300}>
      <Puck
        key={editor.key}
        config={config}
        data={editor.data as Partial<Data>}
        onChange={onChange}
        metadata={metadata}
        iframe={{ enabled: true }}
        permissions={following ? readOnlyPermissions : editPermissions}
      >
        <StudioLayout {...props} theme={theme} themeEditor={themeEditor} sync={sync} mode={mode} setMode={setMode} replace={replace} lease={lease} pushRef={pushRef} />
      </Puck>
    </TooltipProvider>
  );
}

// ----------------------------------------------------------------- layout ---

function StudioLayout({
  site,
  index,
  view,
  document: doc,
  theme,
  canPublish,
  audience,
  themeEditor,
  sync,
  mode,
  setMode,
  replace,
  lease,
  pushRef,
}: StudioEditorProps & {
  themeEditor: ThemeEditor;
  sync: DocumentSync;
  mode: "light" | "dark";
  setMode: (m: "light" | "dark") => void;
  replace: (next: { data: unknown; version: number; hasUnpublishedChanges: boolean }) => void;
  lease: StudioLease;
  pushRef: React.RefObject<(data: unknown) => void>;
}) {
  const router = useRouter();
  const wide = useMedia("(min-width: 1024px)");
  const tabletUp = useMedia("(min-width: 768px)");
  const [viewport, setViewport] = useState<Viewport>("fit");
  const params = useSearchParams();
  const [leftTab, setLeftTab] = useState<"sections" | "add" | "theme">(params.get("panel") === "theme" && themeEditor.draft ? "theme" : "sections");
  const [leftOpen, setLeftOpen] = useState(params.get("panel") === "theme");
  const [sheet, setSheet] = useState<null | "sections" | "add" | "fields" | "theme">(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [addAt, setAddAt] = useState<{ index: number; after: string | null } | null>(null);
  const getPuck = useGetPuck();

  const history = usePuck((s) => s.history);
  const selected = usePuck((s) => s.selectedItem);
  useReportPresence({ documentId: doc.id, blockId: selected ? String(selected.props.id) : undefined });
  const componentLabel = usePuck((s) => (s.selectedItem ? s.config.components[s.selectedItem.type]?.label ?? s.selectedItem.type : null));

  // ------------------------------------------------ lease + live canvas ---
  const following = lease.role === "follower";
  const received = useRef(false);
  const live = useLiveCanvas({
    siteId: site.id,
    documentId: doc.id,
    role: lease.role,
    clientId: lease.clientId,
    onRemote: (data) => {
      received.current = true;
      getPuck().dispatch({ type: "setData", data: data as Data });
    },
  });
  pushRef.current = live.push;

  const prevRole = useRef(lease.role);
  useEffect(() => {
    const was = prevRole.current;
    prevRole.current = lease.role;
    if (lease.role !== "editor" || was === "editor") return;
    if (was !== "follower") return live.start(getPuck().appState.data);
    // Took over from someone: rebase autosave on the latest saved draft. The
    // live canvas we followed may be ahead of it (their last edits); keep it.
    void (async () => {
      const res = await loadDraftAction(site.slug, doc.id);
      if (!res.ok) return void toast.error(res.error);
      if (!received.current) {
        replace(res);
        live.start(res.data);
        return;
      }
      const current = getPuck().appState.data;
      sync.reset(res.data, res.version, res.hasUnpublishedChanges);
      sync.onChange(current);
      live.start(current);
    })();
  }, [lease.role, live, getPuck, site.slug, doc.id, replace, sync]);

  // Requests for control (holder side).
  const shownRequests = useRef(new Set<string>());
  useEffect(() => {
    const ids = new Set(lease.requests.map((r) => `lease-${r.clientId}`));
    for (const id of shownRequests.current) if (!ids.has(id)) toast.dismiss(id);
    shownRequests.current = ids;
    for (const r of lease.requests) {
      toast(`${r.name} wants to edit ${view.label}`, {
        id: `lease-${r.clientId}`,
        duration: 60_000,
        action: {
          label: "Give control",
          onClick: async () => {
            await sync.flush();
            await lease.grant(r);
            toast.success(`${r.name} is editing now`, { duration: 2000 });
          },
        },
        cancel: { label: "Keep", onClick: () => lease.dismiss(r) },
        onDismiss: () => lease.dismiss(r),
      });
    }
  }, [lease, sync, view.label]);

  const dual = theme?.modeStrategy === "dual";
  const exitHref = `/${site.slug}/online-store`;

  const themeSync = themeEditor.sync;
  // While the Theme panel is open, undo/redo and the save status follow the theme.
  const themeActive = !!themeEditor.draft && (tabletUp ? leftTab === "theme" && (wide || leftOpen) : sheet === "theme");
  const undo = themeActive
    ? { can: themeEditor.canUndo, run: themeEditor.undo, label: "Undo theme change" }
    : { can: history.hasPast && !following, run: () => history.back(), label: "Undo" };
  const redo = themeActive
    ? { can: themeEditor.canRedo, run: themeEditor.redo, label: "Redo theme change" }
    : { can: history.hasFuture && !following, run: () => history.forward(), label: "Redo" };
  const themeDirty = !!themeEditor.draft && themeSync.hasUnpublishedChanges;
  const docDirty = sync.hasUnpublishedChanges;

  // One Publish for what you see: the page and, when edited, the theme.
  const publish = useCallback(async () => {
    if (!canPublish) return;
    setPublishing(true);
    try {
      if (!(await sync.flush()) || (themeDirty && !(await themeSync.flush()))) {
        toast.error("Resolve the save problem before publishing.");
        return;
      }
      if (themeDirty && themeEditor.issues.length) {
        toast.error("The theme has an invalid value. Fix it before publishing.");
        return;
      }
      const done: string[] = [];
      if (themeDirty) {
        const res = await publishThemeAction(site.slug, { themeId: themeEditor.id });
        if (!res.ok) return void toast.error(res.error);
        themeSync.markPublished();
        done.push(`theme v${res.version}`);
      }
      if (docDirty) {
        const res = await publishAction(site.slug, { documentId: doc.id, baseVersion: sync.version() });
        if (res.ok) {
          sync.markPublished();
          done.push(`page v${res.version}`);
        } else if ("conflict" in res) {
          return void toast.error("Someone saved a newer version. Reload before publishing.");
        } else return void toast.error(res.error);
      }
      toast.success(docDirty ? `${view.label} is live` : "Theme is live", { description: `Published ${done.join(" and ")}.` });
      router.refresh();
    } finally {
      setPublishing(false);
    }
  }, [canPublish, sync, themeSync, themeDirty, docDirty, themeEditor.id, themeEditor.issues.length, site.slug, doc.id, view.label, router]);

  const go = useCallback(
    async (key: string) => {
      const saved = (await sync.flush()) && (await themeSync.flush());
      if (!saved && !window.confirm("Your latest changes couldn't be saved. Leave anyway?")) return;
      router.push(studioHref(site.slug, key));
    },
    [sync, themeSync, router, site.slug],
  );

  // ⌘S saves now — also when focus is inside the canvas iframe.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void Promise.all([sync.flush(), themeSync.flush()]).then(([a, b]) => a && b && toast.success("Saved", { duration: 1200 }));
      }
    };
    window.addEventListener("keydown", onKey);
    let frameDoc: Document | null = null;
    const attach = () => {
      const frame = window.document.querySelector<HTMLIFrameElement>("#preview-frame, iframe[title='Preview']");
      const d = frame?.contentDocument ?? null;
      if (d && d !== frameDoc) {
        frameDoc?.removeEventListener("keydown", onKey);
        frameDoc = d;
        d.addEventListener("keydown", onKey);
      }
    };
    const t = setInterval(attach, 1000);
    attach();
    return () => {
      clearInterval(t);
      window.removeEventListener("keydown", onKey);
      frameDoc?.removeEventListener("keydown", onKey);
    };
  }, [sync, themeSync]);

  // ⌘Z / ⇧⌘Z drive the theme history while its panel is open (text fields keep native undo).
  useEffect(() => {
    if (!themeActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable='true']")) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (key === "y" || e.shiftKey) themeEditor.redo();
      else themeEditor.undo();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [themeActive, themeEditor]);

  // Phones: selecting a block opens its settings.
  useEffect(() => {
    if (!tabletUp && selected) setSheet("fields");
  }, [selected, tabletUp]);

  // New sections go after the selected one (or its top-level ancestor), else at the end.
  const openAddSection = useCallback(() => {
    const { appState, selectedItem, config } = getPuck();
    const content = appState.data.content ?? [];
    let index = content.length;
    let after: string | null = null;
    if (selectedItem) {
      const id = String(selectedItem.props.id);
      const top = content.findIndex((n) => n.props.id === id || JSON.stringify(n.props).includes(`"${id}"`));
      if (top >= 0) {
        index = top + 1;
        const t = content[top]!.type;
        after = config.components[t]?.label ?? t;
      }
    }
    setSheet(null);
    setAddAt({ index, after });
  }, [getPuck]);

  const insertSection = useCallback(
    (entry: SectionEntry) => {
      if (!addAt) return;
      const node = instantiate(registry, entry.type, { preset: entry.preset });
      const { dispatch } = getPuck();
      const index = addAt.index;
      dispatch({
        type: "setData",
        recordHistory: true,
        data: (prev) => {
          const content = [...(prev.content ?? [])];
          content.splice(Math.min(index, content.length), 0, node as (typeof content)[number]);
          return { ...prev, content };
        },
      });
      dispatch({ type: "setUi", ui: { itemSelector: { index, zone: ROOT_ZONE } } });
      setAddAt(null);
      toast.success(`${entry.label} added`, { duration: 1500 });
      // Bring the new section into view once the canvas has rendered it.
      setTimeout(() => {
        const frame = window.document.querySelector<HTMLIFrameElement>("#preview-frame, iframe[title='Preview']");
        frame?.contentDocument
          ?.querySelector(`[data-puck-component="${CSS.escape(String(node.props.id))}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    },
    [addAt, getPuck],
  );

  const vp = viewports.find((v) => v.id === viewport)!;

  const left = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 gap-1 border-b p-1.5" role="tablist">
        {(
          [
            ["sections", "Sections", Layers],
            ["add", "Blocks", Blocks],
            ...(themeEditor.draft ? ([["theme", "Theme", Paintbrush]] as const) : []),
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            role="tab"
            aria-selected={leftTab === id}
            onClick={() => setLeftTab(id)}
            className={cn(
              "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-[13px] font-medium transition-colors",
              leftTab === id ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>
      {leftTab === "theme" ? (
        <div className="min-h-0 flex-1">
          <ThemePanel site={site.slug} editor={themeEditor} builder={audience === "builder"} mode={mode} setMode={setMode} />
        </div>
      ) : (
        <div className={cn("studio-puck-panel min-h-0 flex-1 overflow-y-auto", leftTab === "add" && "px-3 py-2")}>
          {leftTab === "sections" ? (
            <Puck.Outline />
          ) : (
            <>
              {following ? (
                <p className="px-1 pt-1 pb-3 text-xs text-muted-foreground">Blocks can be added once you are editing.</p>
              ) : (
                <>
                  <p className="px-1 pt-1 pb-3 text-xs text-muted-foreground">Drag a block into any section, or onto the page.</p>
                  <Puck.Components />
                </>
              )}
            </>
          )}
        </div>
      )}
      {leftTab === "sections" && !following && (
        <div className="shrink-0 border-t p-2">
          <button
            type="button"
            onClick={openAddSection}
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed text-[13px] font-medium text-primary transition-colors hover:border-primary/50 hover:bg-primary/5"
          >
            <Plus className="size-4" /> Add section
          </button>
        </div>
      )}
    </div>
  );

  const right = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b px-4">
        <SlidersHorizontal className="size-3.5 text-muted-foreground" />
        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold">{componentLabel ?? (view.resourceKind ? `${view.label} settings` : "Settings")}</p>
      </div>
      <div className="studio-puck-panel min-h-0 flex-1 overflow-y-auto">
        <Puck.Fields />
      </div>
    </div>
  );

  return (
    <div className="studio flex h-dvh flex-col overflow-hidden bg-muted/40 text-foreground">
      {/* ------------------------------------------------------ top bar --- */}
      <header className="relative z-20 flex h-14 shrink-0 items-center gap-1.5 border-b bg-background px-2 sm:gap-2 sm:px-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" asChild className="size-9 shrink-0">
              <Link href={exitHref} aria-label="Exit editor"><X /></Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Exit editor</TooltipContent>
        </Tooltip>
        {tabletUp && !wide && (
          <Button variant={leftOpen ? "secondary" : "ghost"} size="icon" className="size-9" aria-label="Toggle sections" onClick={() => setLeftOpen((o) => !o)}>
            <PanelLeft />
          </Button>
        )}
        <div className="hidden min-w-0 flex-col leading-tight xl:flex xl:w-56 2xl:w-72">
          <span className="truncate text-[13px] font-semibold">{site.name}</span>
          <span className="truncate text-xs text-muted-foreground">
            {theme?.name ?? "No theme"}
            {themeDirty && <span className="text-amber-600"> · edited</span>}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 justify-center">
          <ViewPicker index={index} current={view} onSelect={go} />
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          {tabletUp && (
            <div className="hidden items-center rounded-lg border bg-muted/50 p-0.5 md:flex" role="radiogroup" aria-label="Preview size">
              {viewports.map((v) => (
                <Tooltip key={v.id}>
                  <TooltipTrigger asChild>
                    <button
                      role="radio"
                      aria-checked={viewport === v.id}
                      aria-label={v.label}
                      onClick={() => setViewport(v.id)}
                      className={cn(
                        "flex size-7 items-center justify-center rounded-md transition-colors",
                        viewport === v.id ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <v.icon className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{v.label}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}
          {dual && tabletUp && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => setMode(mode === "light" ? "dark" : "light")} aria-label="Toggle preview mode">
                  {mode === "light" ? <Sun /> : <Moon />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Preview {mode === "light" ? "dark" : "light"} mode</TooltipContent>
            </Tooltip>
          )}
          <div className="flex items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" disabled={!undo.can} onClick={undo.run} aria-label={undo.label}>
                  <Undo2 />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{undo.label} <Kbd>⌘Z</Kbd></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="hidden size-8 sm:inline-flex" disabled={!redo.can} onClick={redo.run} aria-label={redo.label}>
                  <Redo2 />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{redo.label} <Kbd>⇧⌘Z</Kbd></TooltipContent>
            </Tooltip>
          </div>

          <DocumentPresence documentId={doc.id} />
          <SaveStatus sync={themeActive ? themeSync : sync} compact={!wide} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" aria-label="More actions"><MoreHorizontal /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              {!tabletUp && (
                <>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Preview size</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={viewport} onValueChange={(v) => setViewport(v as Viewport)}>
                    {viewports.map((v) => (
                      <DropdownMenuRadioItem key={v.id} value={v.id}>{v.label}</DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                  <DropdownMenuItem disabled={!redo.can} onSelect={redo.run}><Redo2 /> {redo.label}</DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem disabled={following} onSelect={() => setHistoryOpen(true)}>
                <History /> Version history
              </DropdownMenuItem>
              <DropdownMenuItem disabled={following} onSelect={() => void sync.flush()}>
                <Check /> Save now <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" disabled={!sync.hasUnpublishedChanges || following} onSelect={() => setConfirmDiscard(true)}>
                <Trash2 /> Discard unpublished changes
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={!canPublish ? 0 : -1}>
                <Button
                  size="sm"
                  className="h-8 gap-1.5 px-3"
                  disabled={!canPublish || following || publishing || (!docDirty && !themeDirty) || sync.status === "conflict" || themeSync.status === "conflict"}
                  onClick={publish}
                >
                  {publishing ? <Loader2 className="animate-spin" /> : <Rocket className="sm:hidden" />}
                  <span className="hidden sm:inline">{docDirty || themeDirty ? "Publish" : "Published"}</span>
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {!canPublish
                ? "Only owners and admins can publish"
                : docDirty && themeDirty
                  ? "Publish this page and the theme changes"
                  : themeDirty
                    ? "Publish the theme changes (all pages)"
                    : docDirty
                      ? "Make your draft live"
                      : "Everything is live"}
            </TooltipContent>
          </Tooltip>
        </div>
      </header>

      {lease.role === "follower" && <FollowBar lease={lease} what={view.label} />}

      {/* -------------------------------------------------------- body --- */}
      <div className="relative flex min-h-0 flex-1">
        {wide ? (
          <aside
            className={cn(
              "flex shrink-0 flex-col border-r bg-background transition-[width] duration-200",
              leftTab === "theme" ? "w-80 2xl:w-88 min-[1920px]:w-96" : "w-68 2xl:w-76 min-[1920px]:w-84",
            )}
          >
            {left}
          </aside>
        ) : tabletUp && leftOpen ? (
          <aside className={cn("absolute inset-y-0 left-0 z-10 flex flex-col border-r bg-background shadow-xl", leftTab === "theme" ? "w-80" : "w-72")}>{left}</aside>
        ) : null}

        <main className="relative flex min-w-0 flex-1 flex-col overflow-auto">
          <div className={cn("flex min-h-0 flex-1 justify-center", tabletUp && "p-3 lg:p-4 min-[1920px]:p-6")}>
            <div
              className={cn(
                "studio-canvas relative h-full min-h-0 overflow-hidden bg-background transition-[width] duration-300 ease-out",
                tabletUp && "rounded-xl border shadow-sm",
              )}
              style={{ width: vp.width ? `min(100%, ${vp.width}px)` : "100%" }}
            >
              <Puck.Preview />
            </div>
          </div>
        </main>

        {tabletUp && (
          <aside className="flex w-72 shrink-0 flex-col border-l bg-background lg:w-80 2xl:w-88 min-[1920px]:w-96">{right}</aside>
        )}
      </div>

      {/* phones: bottom bar + sheets */}
      {!tabletUp && (
        <>
          <nav className={cn("grid shrink-0 border-t bg-background pb-[env(safe-area-inset-bottom)]", themeEditor.draft ? "grid-cols-4" : "grid-cols-3")}>
            {(
              [
                ["sections", "Sections", Layers],
                ["add", "Add", Plus],
                ...(themeEditor.draft ? ([["theme", "Theme", Paintbrush]] as const) : []),
                ["fields", selected ? "Edit block" : "Settings", SlidersHorizontal],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => {
                  if (id === "add") return openAddSection();
                  if (id === "sections" || id === "theme") setLeftTab(id);
                  setSheet(id);
                }}
                className={cn("flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", id === "fields" && selected ? "text-primary" : "text-muted-foreground")}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </nav>
          <Sheet open={sheet !== null} onOpenChange={(o) => !o && setSheet(null)}>
            <SheetContent side="bottom" onOpenAutoFocus={(e) => e.preventDefault()} className={cn("gap-0 rounded-t-2xl p-0", sheet === "theme" ? "h-[86dvh]" : "h-[72dvh]")}>
              <SheetHeader className="sr-only">
                <SheetTitle>{sheet === "fields" ? "Block settings" : sheet === "add" ? "Add block" : sheet === "theme" ? "Theme" : "Sections"}</SheetTitle>
              </SheetHeader>
              <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" aria-hidden />
              <div className="min-h-0 flex-1">
                {sheet === "fields" ? right : sheet === "theme" ? <ThemePanel site={site.slug} editor={themeEditor} builder={audience === "builder"} mode={mode} setMode={setMode} /> : left}
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}

      <AddSectionDialog
        open={addAt !== null}
        onOpenChange={(o) => !o && setAddAt(null)}
        siteSlug={site.slug}
        capabilities={site.capabilities}
        insertAfter={addAt?.after ?? null}
        themeName={theme?.name}
        onInsert={insertSection}
      />

      <BlockPresenceOverlay documentId={doc.id} />
      <HistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        site={site.slug}
        documentId={doc.id}
        canPublish={canPublish}
        beforeChange={sync.flush}
        onReplaced={replace}
      />

      <ConflictDialog sync={sync} load={() => loadDraftAction(site.slug, doc.id)} onReplaced={replace} />
      {themeEditor.draft && (
        <ConflictDialog sync={themeSync} what="theme" load={() => loadThemeAction(site.slug, themeEditor.id)} onReplaced={themeEditor.replace} />
      )}

      <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Discard unpublished changes?</DialogTitle>
            <DialogDescription>
              Your draft of <strong>{view.label}</strong> goes back to what’s live now. Saved versions stay in Version history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDiscard(false)}>Keep editing</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                const res = await discardDraftAction(site.slug, doc.id);
                setConfirmDiscard(false);
                if (!res.ok) return toast.error(res.error);
                replace(res);
                toast.success("Changes discarded");
              }}
            >
              Discard changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ------------------------------------------------------------- follow bar ---

function FollowBar({ lease, what }: { lease: StudioLease; what: string }) {
  const h = lease.holder;
  const [busy, setBusy] = useState(false);
  const ask = async () => {
    setBusy(true);
    try {
      const res = await lease.request();
      if (!res.granted && res.holder) toast(`Asked ${res.holder.name} for control`, { duration: 2500 });
    } catch {
      toast.error("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const sameUser = h && lease.holder?.userId === lease.self;
  const label = !h ? `Nobody is editing ${what}.` : sameUser ? `You are editing ${what} in another tab.` : `${h.name} is editing ${what}. You see their changes live.`;
  const action = !h ? "Start editing" : sameUser ? "Edit here" : lease.requested ? "Requested…" : "Request edit";
  return (
    <div role="status" className="flex shrink-0 items-center gap-2 border-b bg-muted/60 px-3 py-1.5 text-[13px] sm:px-4">
      <span className="size-2 shrink-0 rounded-full" style={{ background: h ? peerColor(h.userId) : "var(--muted-foreground)" }} />
      <Eye className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <Button size="sm" variant="outline" className="h-7" disabled={busy || (lease.requested && !!h && !sameUser)} onClick={ask}>
        {busy && <Loader2 className="animate-spin" />} {action}
      </Button>
    </div>
  );
}

// ------------------------------------------------------------ save status ---

function SaveStatus({ sync, compact }: { sync: DocumentSync; compact: boolean }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  const map = {
    saved: { icon: <Check className="size-3.5 text-emerald-600" />, text: "Saved", hint: sync.savedAt ? `Draft saved ${relativeTime(sync.savedAt)}` : "Draft is up to date" },
    dirty: { icon: <span className="size-2 rounded-full bg-amber-500" />, text: "Unsaved", hint: "Saving shortly · ⌘S to save now" },
    saving: { icon: <Loader2 className="size-3.5 animate-spin" />, text: "Saving…", hint: "Saving your draft" },
    error: { icon: <CloudOff className="size-3.5 text-destructive" />, text: "Not saved", hint: sync.error ?? "Couldn't save. Click to retry." },
    conflict: { icon: <AlertTriangle className="size-3.5 text-amber-600" />, text: "Conflict", hint: "Someone else changed this" },
  }[sync.status];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => sync.status === "error" && void sync.flush()}
          className="flex h-8 items-center gap-1.5 rounded-md px-1.5 text-xs text-muted-foreground tabular-nums hover:bg-muted"
          aria-live="polite"
        >
          {map.icon}
          {!compact && <span className="hidden sm:inline">{map.text}</span>}
        </button>
      </TooltipTrigger>
      <TooltipContent>{map.hint}</TooltipContent>
    </Tooltip>
  );
}

// --------------------------------------------------------------- conflict ---

function ConflictDialog({
  sync,
  load,
  what = "page",
  onReplaced,
}: {
  sync: DocumentSync;
  load: () => Promise<{ ok: true; data: unknown; version: number; hasUnpublishedChanges: boolean } | { ok: false; error: string }>;
  what?: "page" | "theme";
  onReplaced: (next: { data: unknown; version: number; hasUnpublishedChanges: boolean }) => void;
}) {
  const [busy, setBusy] = useState<null | "theirs" | "mine">(null);
  const c = sync.conflict;
  return (
    <Dialog open={!!c}>
      <DialogContent showCloseButton={false} className="sm:max-w-md" onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><AlertTriangle className="size-4 text-amber-600" /> {what === "theme" ? "The theme" : "This page"} was changed elsewhere</DialogTitle>
          <DialogDescription>
            {c?.updatedByName ?? "Someone"} saved a newer draft {c ? relativeTime(c.updatedAt) : ""}, maybe in another tab.
            Load their version, or keep yours and replace theirs.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={!!busy}
            onClick={async () => {
              setBusy("theirs");
              const res = await load();
              setBusy(null);
              if (!res.ok) return toast.error(res.error);
              onReplaced(res);
            }}
          >
            {busy === "theirs" && <Loader2 className="animate-spin" />} Load their version
          </Button>
          <Button
            disabled={!!busy}
            onClick={async () => {
              setBusy("mine");
              await sync.overwrite();
              setBusy(null);
            }}
          >
            {busy === "mine" && <Loader2 className="animate-spin" />} Keep mine
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
