"use client";

import { previewTransition, resolveEasing } from "@qubo/blocks/runtime";
import {
  iconMotions,
  navMoves,
  transitionBackgrounds,
  transitionIcons,
  transitionMoves,
  type Mode,
  type NavMove,
  type Theme,
  type Transition,
} from "@qubo/stylekit";
import { cn } from "@qubo/shared/utils";
import { Check, Play } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Field, Group, SliderField, uniqueSlug } from "./controls";
import { AddButton, DurationField, EasingField, duplicateIn, NameInput, PaintField, PresetRows, roleSwatch, type ThemeUpdate } from "./design-controls";
import { ThemeScope } from "./preview";
import { useCopyName } from "./use-labels";

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A tiny page mock the overlay plays over. */
function Stage({ theme, mode, stageRef, className, children }: { theme: Theme; mode: Mode; stageRef: React.RefObject<HTMLDivElement | null>; className?: string; children?: React.ReactNode }) {
  const tr = useTranslations("studio.theme.transitions");
  return (
    <ThemeScope theme={theme} mode={mode} className={cn("relative isolate overflow-hidden rounded-lg ring-1 ring-border", className)} style={{ background: "var(--qb-background)" }}>
      <div ref={stageRef} className="relative flex aspect-[16/10] flex-col gap-2 p-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-8 rounded-full" style={{ background: "var(--qb-heading)", opacity: 0.8 }} />
          <span className="flex-1" />
          {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-5 rounded-full" style={{ background: "var(--qb-text-muted)", opacity: 0.5 }} />)}
        </div>
        <div className="flex flex-1 flex-col items-start justify-center gap-1.5">
          <span className="qb-font-heading" style={{ fontSize: 18, lineHeight: 1.1, color: "var(--qb-heading)" }}>{tr("stage.title")}</span>
          <span className="h-1.5 w-3/4 rounded-full" style={{ background: "var(--qb-text-muted)", opacity: 0.35 }} />
          <span className="h-1.5 w-1/2 rounded-full" style={{ background: "var(--qb-text-muted)", opacity: 0.35 }} />
          <span className="qb-button mt-1" data-emphasis="primary" data-size="sm" style={{ fontSize: 10, pointerEvents: "none" }}>{tr("stage.cta")}</span>
        </div>
        {children}
      </div>
    </ThemeScope>
  );
}

function TestButton({ onTest, disabled }: { onTest: () => Promise<void>; disabled?: boolean }) {
  const tr = useTranslations("studio.theme.transitions");
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      className="h-7 gap-1.5 text-xs"
      disabled={busy || disabled}
      onClick={async () => {
        setBusy(true);
        try {
          await onTest();
        } finally {
          setBusy(false);
        }
      }}
    >
      <Play className="size-3" /> {tr("test")}
    </Button>
  );
}

export function TransitionsPage({ theme, update, mode }: { theme: Theme; update: ThemeUpdate; mode: Mode }) {
  const tr = useTranslations("studio.theme.transitions");
  const copyName = useCopyName();
  const [open, setOpen] = useState<string | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const mo = theme.motion;
  const setMotion = (patch: Partial<Theme["motion"]>, key?: string) => update((th) => ({ ...th, motion: { ...th.motion, ...patch } }), key);
  const setList = (fn: (l: Transition[]) => Transition[], key?: string) => update((th) => ({ ...th, motion: { ...th.motion, transitions: fn(th.motion.transitions) } }), key);
  const current = mo.transitions.find((t) => t.id === open);
  const active = mo.transitions.find((t) => t.id === mo.transition);
  const off = mo.profile === "none";

  if (current) {
    return (
      <TransitionEditor
        theme={theme}
        mode={mode}
        transition={current}
        isActive={mo.transition === current.id}
        onUse={() => setMotion({ transition: current.id })}
        onBack={() => setOpen(null)}
        onChange={(t, key) => setList((l) => l.map((x) => (x.id === t.id ? t : x)), key)}
      />
    );
  }

  return (
    <div>
      <Group
        title={tr("betweenPages")}
        description={off ? tr("motionOff") : tr("betweenPagesHint")}
        action={active && <TestButton onTest={() => previewTransition(stage.current!, active, { theme, scope: "contained", hold: 500, reduced: reducedMotion() })} />}
      >
        <div className={cn("space-y-3", off && "pointer-events-none opacity-50")}>
          <Stage theme={theme} mode={mode} stageRef={stage} />
          <Select value={mo.transition || "__none"} onValueChange={(v) => setMotion({ transition: v === "__none" ? "" : v })}>
            <SelectTrigger size="sm" className="h-8 w-full text-xs" aria-label={tr("pageTransition")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none" className="text-xs">{tr("noneInstant")}</SelectItem>
              <SelectItem value="native" className="text-xs">{tr("native")}</SelectItem>
              {mo.transitions.map((t) => <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {mo.transition === "native" && <p className="text-xs text-muted-foreground">{tr("nativeNote")}</p>}
        </div>
      </Group>

      <Group title={tr("presets")} description={tr("presetsDescription")}>
        <PresetRows
          items={mo.transitions}
          preview={(t) => <TransitionChip theme={theme} mode={mode} transition={t} />}
          meta={(t) => `${tr(`backgrounds.${t.background}`)} · ${tr(`moves.${t.move}`)} · ${tr("totalMs", { ms: t.durationIn + t.durationOut })}`}
          badge={(t) => (t.id === mo.transition ? <Check className="size-3.5 text-primary" aria-label={tr("inUse")} /> : null)}
          onOpen={setOpen}
          onDuplicate={(id) => {
            const r = duplicateIn(mo.transitions, id, copyName);
            setList(() => r.list);
            setOpen(r.id);
          }}
          onDelete={(id) => update((th) => ({ ...th, motion: { ...th.motion, transitions: th.motion.transitions.filter((x) => x.id !== id), transition: th.motion.transition === id ? "" : th.motion.transition } }))}
        />
        <AddButton
          label={tr("new")}
          onClick={() => {
            const id = uniqueSlug("transition", mo.transitions.map((t) => t.id));
            setList((l) => [
              ...l,
              { id, name: tr("new"), background: "solid", color: { role: "primary", alpha: 1 }, blur: 12, move: "fade", icon: "mark", iconScale: 1, iconRotation: 0, iconMotion: "pulse", durationIn: 300, durationOut: 400, minVisible: 300, easing: "" },
            ]);
            setOpen(id);
          }}
        />
      </Group>

      <NavMotion theme={theme} mode={mode} setMotion={setMotion} />
    </div>
  );
}

function TransitionChip({ theme, mode, transition: t }: { theme: Theme; mode: Mode; transition: Transition }) {
  const color = roleSwatch(theme, mode, t.color.role);
  const bg = t.background === "radial" ? `radial-gradient(circle, ${color} 0%, transparent 72%)` : color;
  return (
    <span className="relative flex h-9 w-14 items-center justify-center overflow-hidden rounded-md ring-1 ring-border" style={{ background: "var(--background)" }}>
      <span className="absolute inset-0" style={{ background: bg, opacity: t.background === "radial" ? 1 : t.color.alpha }} />
      {t.icon !== "none" && <span className="relative size-2 rounded-full bg-white/90 ring-1 ring-black/10" />}
    </span>
  );
}

function TransitionEditor({
  theme,
  mode,
  transition: t,
  isActive,
  onUse,
  onChange,
  onBack,
}: {
  theme: Theme;
  mode: Mode;
  transition: Transition;
  isActive: boolean;
  onUse: () => void;
  onChange: (t: Transition, key?: string) => void;
  onBack: () => void;
}) {
  const tr = useTranslations("studio.theme.transitions");
  const stage = useRef<HTMLDivElement>(null);
  const set = (patch: Partial<Transition>, key?: string) => onChange({ ...t, ...patch }, key);
  const hasBrand = !!(theme.brand.mark?.url || theme.brand.logo?.url || theme.brand.favicon?.url);
  return (
    <div>
      <div className="sticky top-0 z-[5] space-y-2 border-b bg-background p-4">
        <Stage theme={theme} mode={mode} stageRef={stage} />
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground">{tr("all")}</button>
          <span className="flex-1" />
          {isActive ? (
            <span className="flex items-center gap-1 text-xs text-primary"><Check className="size-3.5" /> {tr("inUse")}</span>
          ) : (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onUse}>{tr("use")}</Button>
          )}
          <TestButton onTest={() => previewTransition(stage.current!, t, { theme, scope: "contained", hold: 300, reduced: reducedMotion() })} />
        </div>
      </div>
      <Group>
        <NameInput value={t.name} onChange={(name) => set({ name }, "name")} />
      </Group>
      <Group title={tr("cover")}>
        <ToggleGroup type="single" variant="outline" size="sm" value={t.background} onValueChange={(v) => v && set({ background: v as Transition["background"] })} className="w-full">
          {transitionBackgrounds.map((b) => <ToggleGroupItem key={b} value={b} className="flex-1 text-xs">{tr(`backgrounds.${b}`)}</ToggleGroupItem>)}
        </ToggleGroup>
        <PaintField theme={theme} mode={mode} label={tr("colour")} value={t.color} onChange={(color) => set({ color }, "color")} />
        {t.background === "translucent" && <SliderField label={tr("blur")} value={t.blur} min={0} max={40} format={(v) => `${v}px`} onChange={(blur) => set({ blur }, "blur")} />}
        <Field label={tr("movement")} inline>
          <Select value={t.move} onValueChange={(v) => set({ move: v as Transition["move"] })}>
            <SelectTrigger size="sm" className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {transitionMoves.map((m) => <SelectItem key={m} value={m} className="text-xs">{tr(`moves.${m}`)}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </Group>
      <Group title={tr("icon")} description={hasBrand || t.icon === "none" ? undefined : tr("iconMissing")}>
        <ToggleGroup type="single" variant="outline" size="sm" value={t.icon} onValueChange={(v) => v && set({ icon: v as Transition["icon"] })} className="w-full">
          {transitionIcons.map((i) => <ToggleGroupItem key={i} value={i} className="flex-1 text-xs">{tr(`icons.${i}`)}</ToggleGroupItem>)}
        </ToggleGroup>
        {t.icon !== "none" && (
          <>
            <Field label={tr("animation")} inline>
              <Select value={t.iconMotion} onValueChange={(v) => set({ iconMotion: v as Transition["iconMotion"] })}>
                <SelectTrigger size="sm" className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {iconMotions.map((m) => <SelectItem key={m} value={m} className="text-xs">{tr(`iconMotions.${m}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <SliderField label={tr("size")} value={t.iconScale} min={0.25} max={4} step={0.05} format={(v) => `×${v.toFixed(2)}`} onChange={(iconScale) => set({ iconScale }, "iconScale")} />
            <SliderField label={tr("rotation")} value={t.iconRotation} min={-180} max={180} step={5} format={(v) => `${v}°`} onChange={(iconRotation) => set({ iconRotation }, "iconRotation")} />
          </>
        )}
      </Group>
      <Group title={tr("timing")} description={tr("timingDescription")}>
        <DurationField label={tr("coverIn")} value={t.durationIn} max={3000} onChange={(durationIn) => set({ durationIn }, "durationIn")} />
        <DurationField label={tr("coverOut")} value={t.durationOut} max={3000} onChange={(durationOut) => set({ durationOut }, "durationOut")} />
        <DurationField label={tr("minHold")} value={t.minVisible} max={5000} hint={tr("minHoldHint")} onChange={(minVisible) => set({ minVisible }, "minVisible")} />
        <EasingField label={tr("easing")} value={t.easing} onChange={(easing) => set({ easing })} />
      </Group>
    </div>
  );
}

const navFrames = (move: NavMove, enter: boolean): Keyframe[] => {
  const hidden: Keyframe =
    move === "slide" ? { transform: "translateX(100%)" } : move === "scale" ? { transform: "scale(0.92)", opacity: 0 } : move === "circle" ? { clipPath: "circle(0% at 100% 0%)" } : { opacity: 0 };
  const shown: Keyframe = move === "slide" ? { transform: "none" } : move === "scale" ? { transform: "none", opacity: 1 } : move === "circle" ? { clipPath: "circle(150% at 100% 0%)" } : { opacity: 1 };
  return enter ? [hidden, shown] : [shown, hidden];
};

function NavMotion({ theme, mode, setMotion }: { theme: Theme; mode: Mode; setMotion: (patch: Partial<Theme["motion"]>, key?: string) => void }) {
  const tr = useTranslations("studio.theme.transitions");
  const stage = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const nav = theme.motion.nav;
  const setNav = (patch: Partial<Theme["motion"]["nav"]>, key?: string) => setMotion({ nav: { ...nav, ...patch } }, key);
  const test = async () => {
    const el = sheet.current;
    if (!el) return;
    const easing = resolveEasing("", theme);
    const reduced = reducedMotion();
    el.style.visibility = "visible";
    await el.animate(navFrames(reduced ? "fade" : nav.enter, true), { duration: nav.durationIn, easing, fill: "forwards" }).finished;
    await new Promise((r) => setTimeout(r, 700));
    const out = el.animate(navFrames(reduced ? "fade" : nav.exit, false), { duration: nav.durationOut, easing, fill: "forwards" });
    await out.finished;
    el.style.visibility = "hidden";
    el.getAnimations().forEach((a) => a.cancel());
  };
  return (
    <Group title={tr("navTitle")} description={tr("navDescription")} action={<TestButton onTest={test} />}>
      <Stage theme={theme} mode={mode} stageRef={stage}>
        <div ref={sheet} className="absolute inset-y-0 right-0 flex w-1/2 flex-col gap-2 p-3" style={{ visibility: "hidden", background: "var(--qb-surface)", boxShadow: "-8px 0 24px oklch(0 0 0 / 0.12)" }}>
          {([tr("navSample.services"), tr("navSample.projects"), tr("navSample.contact")]).map((l) => <span key={l} className="qb-font-heading" style={{ fontSize: 13, color: "var(--qb-on-surface)" }}>{l}</span>)}
        </div>
      </Stage>
      <div className="grid grid-cols-2 gap-2">
        <NavMoveSelect label={tr("enter")} value={nav.enter} onChange={(enter) => setNav({ enter })} />
        <NavMoveSelect label={tr("leave")} value={nav.exit} onChange={(exit) => setNav({ exit })} />
      </div>
      <DurationField label={tr("enter")} value={nav.durationIn} max={2000} onChange={(durationIn) => setNav({ durationIn }, "nav-in")} />
      <DurationField label={tr("leave")} value={nav.durationOut} max={2000} onChange={(durationOut) => setNav({ durationOut }, "nav-out")} />
    </Group>
  );
}

function NavMoveSelect({ label, value, onChange }: { label: string; value: NavMove; onChange: (v: NavMove) => void }) {
  const tr = useTranslations("studio.theme.transitions");
  return (
    <div className="space-y-1.5">
      <p className="text-[13px] font-medium">{label}</p>
      <Select value={value} onValueChange={(v) => onChange(v as NavMove)}>
        <SelectTrigger size="sm" className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {navMoves.map((m) => <SelectItem key={m} value={m} className="text-xs">{tr(`navMoves.${m}`)}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
