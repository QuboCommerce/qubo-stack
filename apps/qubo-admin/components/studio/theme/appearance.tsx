"use client";

import { collapseMode, entrancePresets, expandToDual, type Mode, type ModeStrategy, type Theme } from "@qubo/stylekit";
import { cn } from "@qubo/shared/utils";
import { Check, Moon, Sun, SunMoon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Group, SliderField } from "./controls";
import { SchemePreview } from "./preview";

const strategies: { id: ModeStrategy; icon: typeof Sun }[] = [
  { id: "dual", icon: SunMoon },
  { id: "light", icon: Sun },
  { id: "dark", icon: Moon },
];

export function AppearancePage({ theme, update, undo, setMode }: { theme: Theme; update: (fn: (t: Theme) => Theme, key?: string) => void; undo: () => void; setMode: (m: Mode) => void }) {
  const t = useTranslations("studio.theme.appearance");
  const choose = (next: ModeStrategy) => {
    const from = theme.modeStrategy;
    if (next === from) return;
    if (next === "dual") {
      update(expandToDual);
      toast.success(t("darkAdded"), {
        description: t("darkAddedHint"),
        action: { label: t("undo"), onClick: undo },
      });
      return;
    }
    // dual → single keeps that mode's colours; single → other single re-labels the same colours.
    update((th) => collapseMode(th.modeStrategy === "dual" ? th : expandToDual(th), next));
    setMode(next);
    toast.success(next === "light" ? t("strategies.light.label") : t("strategies.dark.label"), {
      description: from === "dual" ? (next === "light" ? t("removedDark") : t("removedLight")) : undefined,
      action: { label: t("undo"), onClick: undo },
    });
  };

  return (
    <div>
      <Group title={t("modesTitle")} description={t("modesDescription")}>
        <div role="radiogroup" className="space-y-2">
          {strategies.map((s) => {
            const active = theme.modeStrategy === s.id;
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => choose(s.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                  active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/60",
                )}
              >
                <s.icon className={cn("mt-0.5 size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium">{t(`strategies.${s.id}.label`)}</span>
                  <span className="block text-xs text-muted-foreground">{t(`strategies.${s.id}.hint`)}</span>
                </span>
                {active && <Check className="size-4 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      </Group>
      <Group title={t("pageDefault")}>
        <div className={cn("grid gap-2", theme.modeStrategy === "dual" && "grid-cols-2")}>
          {(theme.modeStrategy === "dual" ? (["light", "dark"] as const) : [theme.modeStrategy]).map((m) => (
            <div key={m} className="space-y-1">
              <SchemePreview theme={theme} scheme={theme.defaultScheme} mode={m} className="ring-1 ring-border" />
              <p className="text-center text-[11px] text-muted-foreground capitalize">{t(`mode.${m}`)}</p>
            </div>
          ))}
        </div>
      </Group>
    </div>
  );
}

const easings = [
  { value: "cubic-bezier(0.2, 0.8, 0.2, 1)", id: "smooth" },
  { value: "cubic-bezier(0.16, 1, 0.3, 1)", id: "expressive" },
  { value: "cubic-bezier(0.4, 0, 0.2, 1)", id: "standard" },
  { value: "cubic-bezier(0.34, 1.56, 0.64, 1)", id: "bouncy" },
  { value: "linear", id: "linear" },
] as const;

const flavors = ["fancy", "grounded"] as const;

export function MotionPage({ theme, update }: { theme: Theme; update: (fn: (t: Theme) => Theme, key?: string) => void }) {
  const t = useTranslations("studio.theme.motion");
  const mo = theme.motion;
  const setMotion = (patch: Partial<Theme["motion"]>, key?: string) => update((th) => ({ ...th, motion: { ...th.motion, ...patch } }), key);
  const setSpace = (patch: Partial<Theme["space"]>, key?: string) => update((th) => ({ ...th, space: { ...th.space, ...patch } }), key);
  const off = mo.profile === "none";

  return (
    <div>
      <Group title={t("title")} description={t("description")}>
        <ToggleGroup type="single" variant="outline" size="sm" value={mo.profile} onValueChange={(v) => v && setMotion({ profile: v as Theme["motion"]["profile"] })} className="w-full">
          <ToggleGroupItem value="none" className="flex-1 text-xs">{t("off")}</ToggleGroupItem>
          <ToggleGroupItem value="subtle" className="flex-1 text-xs">{t("subtle")}</ToggleGroupItem>
          <ToggleGroupItem value="lively" className="flex-1 text-xs">{t("lively")}</ToggleGroupItem>
        </ToggleGroup>
        <div className={cn("space-y-3.5", off && "pointer-events-none opacity-50")}>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <p className="text-[13px] font-medium">{t("sectionsAppear")}</p>
              <Select value={mo.entrance} onValueChange={(v) => setMotion({ entrance: v as Theme["motion"]["entrance"] })}>
                <SelectTrigger size="sm" className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {entrancePresets.map((e) => <SelectItem key={e} value={e} className="text-xs">{t(`entrance.${e}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <p className="text-[13px] font-medium">{t("easing")}</p>
              <Select value={mo.easing} onValueChange={(v) => setMotion({ easing: v })}>
                <SelectTrigger size="sm" className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {!easings.some((e) => e.value === mo.easing) && <SelectItem value={mo.easing} className="text-xs">{t("custom")}</SelectItem>}
                  {easings.map((e) => <SelectItem key={e.value} value={e.value} className="text-xs">{t(`easings.${e.id}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <SliderField
            label={t("speed")}
            value={mo.durationBase}
            min={120}
            max={800}
            step={20}
            format={(v) => `${v}ms`}
            hint={t("speedHint")}
            onChange={(v) => setMotion({ durationBase: v, durationFast: Math.round(v / 2), durationSlow: v * 2 }, "speed")}
          />
        </div>
      </Group>

      <Group title={t("spacing")} description={t("spacingDescription")}>
        <SliderField label={t("unitPhone")} value={theme.space.unitMin} min={2} max={8} step={0.5} format={(v) => `${v}px`} onChange={(v) => setSpace({ unitMin: v }, "umin")} />
        <SliderField label={t("unitDesktop")} value={theme.space.unitMax} min={3} max={10} step={0.5} format={(v) => `${v}px`} onChange={(v) => setSpace({ unitMax: v }, "umax")} />
      </Group>

      <Group title={t("flavorTitle")} description={t("flavorDescription")}>
        <div role="radiogroup" className="grid grid-cols-2 gap-2">
          {flavors.map((f) => {
            const active = theme.flavor.id === f;
            return (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => update((th) => ({ ...th, flavor: { ...th.flavor, id: f } }))}
                className={cn("rounded-lg border p-2.5 text-left transition-colors", active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/60")}
              >
                <FlavorSketch id={f} />
                <span className="mt-2 block text-[13px] font-medium">{t(`flavors.${f}.label`)}</span>
                <span className="block text-[11px] leading-snug text-muted-foreground">{t(`flavors.${f}.hint`)}</span>
              </button>
            );
          })}
        </div>
      </Group>
    </div>
  );
}

function FlavorSketch({ id }: { id: string }) {
  const bar = "rounded-[2px] bg-muted-foreground/25";
  return id === "grounded" ? (
    <span className="flex h-14 gap-1 rounded-md bg-muted p-1" aria-hidden>
      <span className="flex w-4 flex-col gap-0.5 rounded-[3px] bg-background p-0.5">
        {[0, 1, 2, 3].map((i) => <span key={i} className={cn(bar, "h-1")} />)}
      </span>
      <span className="flex flex-1 flex-col gap-1 rounded-[3px] bg-background p-1">
        <span className={cn(bar, "h-1.5 w-2/3")} />
        <span className="grid flex-1 grid-cols-3 gap-0.5">{[0, 1, 2].map((i) => <span key={i} className={bar} />)}</span>
      </span>
    </span>
  ) : (
    <span className="flex h-14 flex-col gap-1 rounded-md bg-muted p-1" aria-hidden>
      <span className="flex h-2.5 items-center gap-0.5 rounded-[3px] bg-background px-1">
        <span className={cn(bar, "h-1 w-3")} />
        <span className="flex-1" />
        {[0, 1, 2].map((i) => <span key={i} className={cn(bar, "h-0.5 w-2")} />)}
      </span>
      <span className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-[3px] bg-background">
        <span className={cn(bar, "h-1.5 w-1/2 bg-primary/40")} />
        <span className={cn(bar, "h-1 w-1/3")} />
      </span>
    </span>
  );
}
