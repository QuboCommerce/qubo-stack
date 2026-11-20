"use client";

import { ThemeStyles } from "@qubo/blocks";
import { diagnoseTheme, type Mode, type Role } from "@qubo/stylekit";
import { cn } from "@qubo/shared/utils";
import {
  AlertTriangle,
  Blend,
  Check,
  Highlighter,
  CloudOff,
  History,
  Loader2,
  MoreHorizontal,
  Move3d,
  Palette,
  Redo2,
  RectangleHorizontal,
  Snowflake,
  Stamp,
  SunMoon,
  SwatchBook,
  Trash2,
  Type,
  Undo2,
  Clapperboard,
} from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  discardThemeDraftAction,
  listThemeRevisionsAction,
  restoreThemeRevisionAction,
  type ThemeRevisionItem,
} from "@/app/theme-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { relativeTime } from "@/lib/format";
import { AppearancePage, MotionPage } from "./appearance";
import { BrandPage } from "./brand";
import { DecorPage } from "./decor";
import { EffectsPage } from "./effects";
import { GradientsPage } from "./surfaces";
import { TransitionsPage } from "./transitions";
import { ButtonsPage } from "./buttons";
import { Group, NavRow, SubHeader, Swatch, tokenColor } from "./controls";
import { DoctorPage, HealthRing } from "./doctor";
import { PalettePage } from "./palette";
import { SchemeDetail, SchemesPage } from "./schemes";
import { TypographyPage } from "./typography";
import type { ThemeEditor } from "./use-theme-editor";

type Page =
  | { id: "home" }
  | { id: "palette"; token?: string; nonce?: number }
  | { id: "schemes" }
  | { id: "scheme"; scheme: string; role?: string; nonce?: number }
  | { id: "appearance" }
  | { id: "typography" }
  | { id: "buttons" }
  | { id: "motion" }
  | { id: "doctor" }
  | { id: "brand" }
  | { id: "gradients" }
  | { id: "decor" }
  | { id: "effects" }
  | { id: "transitions" };

type SimplePage = Exclude<Page["id"], "scheme">;

export type ThemeNav = {
  go: (id: SimplePage) => void;
  scheme: (id: string, mode?: Mode, role?: Role | string) => void;
  token: (id: string) => void;
};

export function ThemePanel({
  site,
  siteId,
  editor,
  builder,
  mode,
  setMode,
}: {
  site: string;
  siteId: string;
  editor: ThemeEditor;
  builder: boolean;
  mode: Mode;
  setMode: (m: Mode) => void;
}) {
  const t = useTranslations("studio.theme.panel");
  const tm = useTranslations("studio.theme.motion");
  const tn = useTranslations("studio.theme.nav");
  const [page, setPage] = useState<Page>({ id: "home" });
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const draft = editor.draft;
  const theme = editor.theme;
  const deferred = useDeferredValue(theme);
  const report = useMemo(() => (deferred ? diagnoseTheme(deferred) : null), [deferred]);

  const nav: ThemeNav = useMemo(
    () => ({
      go: (id) => setPage({ id } as Page),
      scheme: (id, m, role) => {
        if (m) setMode(m);
        setPage({ id: "scheme", scheme: id, role, nonce: Date.now() });
      },
      token: (id) => setPage({ id: "palette", token: id, nonce: Date.now() }),
    }),
    [setMode],
  );

  // A scheme that was deleted (or undone away) can't stay open.
  useEffect(() => {
    if (page.id === "scheme" && draft && !draft.schemes.some((s) => s.id === page.scheme)) setPage({ id: "schemes" });
  }, [draft, page]);

  if (!draft || !theme || !report) {
    return <p className="p-4 text-[13px] text-muted-foreground">{t("noTheme")}</p>;
  }

  const counts = { error: 0, warning: 0 };
  for (const f of report.findings) if (f.severity !== "info") counts[f.severity]++;
  const back = () => setPage(page.id === "scheme" ? { id: "schemes" } : { id: "home" });
  const currentScheme = page.id === "scheme" ? draft.schemes.find((s) => s.id === page.scheme) : undefined;
  const update = editor.update;

  const undoRedo = (
    <div className="flex items-center">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7" disabled={!editor.canUndo} onClick={editor.undo} aria-label={t("undo")}><Undo2 className="size-3.5" /></Button>
        </TooltipTrigger>
        <TooltipContent>{t("undo")}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7" disabled={!editor.canRedo} onClick={editor.redo} aria-label={t("redo")}><Redo2 className="size-3.5" /></Button>
        </TooltipTrigger>
        <TooltipContent>{t("redo")}</TooltipContent>
      </Tooltip>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Real theme CSS + fonts for every preview in this panel. */}
      <ThemeStyles theme={theme} />

      {page.id !== "home" && (
        <SubHeader
          title={page.id === "scheme" ? currentScheme?.name || t("scheme") : tn(`titles.${page.id}`)}
          subtitle={page.id === "scheme" ? t("schemeSubtitle") : undefined}
          onBack={back}
          actions={undoRedo}
        />
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {page.id === "home" && (
          <>
            <div className="border-b p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <input
                    value={draft.name}
                    onChange={(e) => update((th) => ({ ...th, name: e.target.value }), "theme-name")}
                    className="-mx-1 w-full rounded-md bg-transparent px-1 py-0.5 text-[15px] font-semibold outline-none hover:bg-muted focus:bg-muted focus:ring-2 focus:ring-ring/30"
                    aria-label={t("name")}
                  />
                  <p className="line-clamp-2 text-xs text-muted-foreground">{draft.description || t("noDescription")}</p>
                </div>
                <button type="button" onClick={() => nav.go("doctor")} className="rounded-full transition-transform hover:scale-105" aria-label={t("openDoctor")}>
                  <HealthRing value={report.health} size={46} />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <ThemeSaveState editor={editor} />
                <div className="ml-auto flex items-center gap-0.5">
                  {undoRedo}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-7" aria-label={t("actions")}><MoreHorizontal className="size-3.5" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onSelect={() => setVersionsOpen(true)}><History /> {t("versions")}</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" disabled={!editor.sync.hasUnpublishedChanges} onSelect={() => setConfirmDiscard(true)}>
                        <Trash2 /> {t("discard")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              {editor.issues.length > 0 && (
                <p className="mt-2 flex items-start gap-1.5 rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                  <AlertTriangle className="mt-px size-3.5 shrink-0" />
                  {t("notSaved", { field: editor.issues[0]!.path.split(".").pop() ?? "", message: editor.issues[0]!.message.toLowerCase() })}
                </p>
              )}
            </div>

            <Group title={tn("groups.colours")} className="px-2 [&>div:first-child]:px-2">
              <div className="space-y-0.5">
                <NavRow
                  icon={<Palette />}
                  label={tn("titles.palette")}
                  meta={
                    <span className="flex items-center gap-1.5">
                      <span className="flex -space-x-1">
                        {draft.palette.slice(0, 8).map((tk) => <Swatch key={tk.id} color={tokenColor(tk)} className="size-3.5 rounded-full ring-2 ring-background" />)}
                      </span>
                      {tn("coloursCount", { count: draft.palette.length })}
                    </span>
                  }
                  onClick={() => nav.go("palette")}
                />
                <NavRow icon={<SwatchBook />} label={tn("titles.schemes")} meta={draft.schemes.map((s) => s.name).join(" · ")} onClick={() => nav.go("schemes")} />
                <NavRow
                  icon={<SunMoon />}
                  label={tn("titles.appearance")}
                  meta={tn(`modes.${draft.modeStrategy}`)}
                  onClick={() => nav.go("appearance")}
                />
              </div>
            </Group>
            <Group title={tn("groups.style")} className="px-2 [&>div:first-child]:px-2">
              <div className="space-y-0.5">
                <NavRow
                  icon={<Type />}
                  label={tn("titles.typography")}
                  meta={Array.from(new Set(draft.typeset.fonts.map((f) => f.family))).join(" · ")}
                  onClick={() => nav.go("typography")}
                />
                <NavRow icon={<RectangleHorizontal />} label={tn("titles.buttons")} meta={tn("buttonsMeta", { count: draft.buttons.length, radius: draft.shape.radius })} onClick={() => nav.go("buttons")} />
                <NavRow icon={<Move3d />} label={tn("titles.motion")} meta={tn("motionMeta", { profile: tm(draft.motion.profile === "none" ? "off" : draft.motion.profile), flavor: tm(`flavors.${draft.flavor.id}.label` as "flavors.fancy.label") })} onClick={() => nav.go("motion")} />
              </div>
            </Group>
            <Group title={tn("groups.design")} className="px-2 [&>div:first-child]:px-2">
              <div className="space-y-0.5">
                <NavRow
                  icon={<Stamp />}
                  label={tn("titles.brand")}
                  meta={[draft.brand.logo?.url && tn("brand.logo"), draft.brand.mark?.url && tn("brand.mark"), draft.brand.favicon?.url && tn("brand.favicon"), draft.brand.voice.tone && tn("brand.voice")].filter(Boolean).join(" · ") || tn("brand.empty")}
                  onClick={() => nav.go("brand")}
                />
                <NavRow icon={<Blend />} label={tn("titles.gradients")} meta={tn("gradientsMeta", { count: draft.surfaces.gradients.length })} onClick={() => nav.go("gradients")} />
                <NavRow icon={<Highlighter />} label={tn("titles.decor")} meta={draft.decor.map((d) => d.name).slice(0, 3).join(" · ") || tn("none")} onClick={() => nav.go("decor")} />
                <NavRow
                  icon={<Snowflake />}
                  label={tn("titles.effects")}
                  meta={draft.effects.active ? tn("effectsActive", { name: draft.effects.presets.find((e) => e.id === draft.effects.active)?.name ?? draft.effects.active }) : tn("effectsCount", { count: draft.effects.presets.length })}
                  onClick={() => nav.go("effects")}
                />
                <NavRow
                  icon={<Clapperboard />}
                  label={tn("titles.transitions")}
                  meta={draft.motion.transition === "native" ? tn("nativeTransition") : draft.motion.transitions.find((x) => x.id === draft.motion.transition)?.name ?? tn("instantTransition")}
                  onClick={() => nav.go("transitions")}
                />
              </div>
            </Group>
            <Group title={tn("groups.health")} className="px-2 [&>div:first-child]:px-2">
              <NavRow
                icon={<HealthRing value={report.health} size={22} className="[&_span]:text-[0px]" />}
                label={tn("titles.doctor")}
                meta={counts.error ? tn("doctorErrors", { errors: counts.error, warnings: counts.warning }) : counts.warning ? tn("doctorWarnings", { count: counts.warning }) : tn("doctorOk")}
                tone={counts.error ? "error" : counts.warning ? "warning" : undefined}
                onClick={() => nav.go("doctor")}
              />
            </Group>
          </>
        )}

        {page.id === "palette" && <PalettePage key={page.nonce} theme={draft} update={update} builder={builder} nav={nav} focusToken={page.token} />}
        {page.id === "schemes" && <SchemesPage theme={theme} update={update} nav={nav} mode={mode} />}
        {page.id === "scheme" && currentScheme && (
          <SchemeDetail key={`${currentScheme.id}-${page.nonce}`} theme={theme} scheme={currentScheme} update={update} report={report} mode={mode} setMode={setMode} focusRole={page.role} nav={nav} />
        )}
        {page.id === "appearance" && <AppearancePage theme={theme} update={update} undo={editor.undo} setMode={setMode} />}
        {page.id === "typography" && <TypographyPage theme={theme} update={update} mode={mode} />}
        {page.id === "buttons" && <ButtonsPage theme={theme} update={update} mode={mode} />}
        {page.id === "motion" && <MotionPage theme={theme} update={update} />}
        {page.id === "brand" && <BrandPage theme={theme} update={update} site={{ slug: site, id: siteId }} mode={mode} />}
        {page.id === "gradients" && <GradientsPage theme={theme} update={update} mode={mode} />}
        {page.id === "decor" && <DecorPage theme={theme} update={update} mode={mode} />}
        {page.id === "effects" && <EffectsPage theme={theme} update={update} mode={mode} />}
        {page.id === "transitions" && <TransitionsPage theme={theme} update={update} mode={mode} />}
        {page.id === "doctor" && <DoctorPage theme={theme} report={report} nav={nav} mode={mode} />}
      </div>

      <ThemeVersions open={versionsOpen} onOpenChange={setVersionsOpen} site={site} editor={editor} />

      <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("discardTitle")}</DialogTitle>
            <DialogDescription>{t("discardDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDiscard(false)}>{t("keepEditing")}</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await editor.sync.flush();
                const res = await discardThemeDraftAction(site, editor.id);
                setConfirmDiscard(false);
                if (!res.ok) return toast.error(res.error);
                editor.replace(res);
                toast.success(t("discarded"));
              }}
            >
              {t("discardConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ThemeSaveState({ editor }: { editor: ThemeEditor }) {
  const t = useTranslations("studio.theme.panel.save");
  const s = editor.sync;
  const map = {
    saved: { icon: <Check className="size-3 text-emerald-600" />, text: s.hasUnpublishedChanges ? t("draft") : t("live") },
    dirty: { icon: <span className="size-1.5 rounded-full bg-amber-500" />, text: t("dirty") },
    saving: { icon: <Loader2 className="size-3 animate-spin" />, text: t("saving") },
    error: { icon: <CloudOff className="size-3 text-destructive" />, text: s.error ?? t("error") },
    conflict: { icon: <AlertTriangle className="size-3 text-amber-600" />, text: t("conflict") },
  }[s.status];
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground", s.status === "error" && "text-destructive")} aria-live="polite">
      {map.icon}
      <span className="truncate">{map.text}</span>
    </span>
  );
}

function ThemeVersions({ open, onOpenChange, site, editor }: { open: boolean; onOpenChange: (o: boolean) => void; site: string; editor: ThemeEditor }) {
  const t = useTranslations("studio.theme.panel.versionsDialog");
  const locale = useLocale();
  const [items, setItems] = useState<ThemeRevisionItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setItems(null);
    const res = await listThemeRevisionsAction(site, editor.id);
    if (res.ok) setItems(res.revisions);
    else toast.error(res.error);
  }, [site, editor.id]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="-mx-2 max-h-[55dvh] overflow-y-auto">
          {items === null ? (
            <div className="space-y-2 px-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : items.length === 0 ? (
            <p className="px-2 py-6 text-center text-[13px] text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="space-y-0.5">
              {items.map((r, i) => (
                <li key={r.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/60">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs">v{r.version}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">
                      {r.label || t("defaultLabel", { version: r.version })}
                      {i === 0 && <span className="ml-1.5 rounded bg-emerald-500/10 px-1.5 py-px text-[10px] font-medium text-emerald-700">{t("latest")}</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{relativeTime(r.createdAt, locale)}{r.createdByName ? ` · ${r.createdByName}` : ""}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={!!busy}
                    onClick={async () => {
                      setBusy(r.id);
                      await editor.sync.flush();
                      const res = await restoreThemeRevisionAction(site, { themeId: editor.id, revisionId: r.id });
                      setBusy(null);
                      if (!res.ok) return toast.error(res.error);
                      editor.replace(res);
                      onOpenChange(false);
                      toast.success(t("restored", { version: r.version }));
                    }}
                  >
                    {busy === r.id && <Loader2 className="animate-spin" />} {t("restore")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
