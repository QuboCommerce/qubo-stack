"use client";

import {
  contrastPairs,
  normalizeRef,
  optionalRoles,
  resolveRoleColor,
  roleFallbacks,
  type DoctorReport,
  type Mode,
  type Role,
  type RoleMap,
  type RoleRef,
  type Scheme,
  type Theme,
} from "@qubo/stylekit";
import { cn } from "@qubo/shared/utils";
import { AlertTriangle, Check, Copy, Moon, MoreHorizontal, Plus, SlidersHorizontal, Star, Sun, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cssColor, Field, Group, MixEditor, Swatch, TokenSelect, uniqueSlug } from "./controls";
import { describeRole } from "./palette";
import { SchemePreview } from "./preview";
import type { ThemeNav } from "./theme-panel";

const roleGroups: { title: string; roles: Role[]; hint?: string }[] = [
  { title: "Page", roles: ["background", "backgroundAlt", "text", "textMuted", "heading", "border"] },
  { title: "Buttons", roles: ["primary", "onPrimary", "secondary", "onSecondary"] },
  { title: "Cards", roles: ["surface", "onSurface"] },
  { title: "Accent & links", roles: ["accent", "onAccent", "accentText", "link", "focusRing"] },
];

const roleHint: Partial<Record<Role, string>> = {
  background: "Section background",
  backgroundAlt: "Alternating bands, image placeholders",
  text: "Body copy",
  textMuted: "Captions, secondary copy",
  heading: "Titles",
  border: "Dividers, inputs, card outlines",
  primary: "Main call to action",
  onPrimary: "Label on primary buttons",
  secondary: "Second call to action",
  onSecondary: "Label on secondary buttons",
  surface: "Cards, panels, inputs",
  onSurface: "Text on cards",
  accent: "Badges, chips, highlights",
  onAccent: "Text on accent fills",
  accentText: "Eyebrows, highlighted words",
  link: "Inline links",
  focusRing: "Keyboard focus outline",
};

export const modesOf = (theme: Theme): Mode[] => (theme.modeStrategy === "dual" ? ["light", "dark"] : [theme.modeStrategy]);

// -------------------------------------------------------------------- list ---

export function SchemesPage({ theme, update, nav, mode }: { theme: Theme; update: (fn: (t: Theme) => Theme, key?: string) => void; nav: ThemeNav; mode: Mode }) {
  const previewMode = modesOf(theme).includes(mode) ? mode : modesOf(theme)[0]!;
  const add = () => {
    const base = theme.schemes.find((s) => s.id === theme.defaultScheme) ?? theme.schemes[0]!;
    const id = uniqueSlug("new-scheme", theme.schemes.map((s) => s.id));
    update((t) => ({ ...t, schemes: [...t.schemes, { ...structuredClone(base), id, name: "New scheme", description: "" }] }));
    nav.scheme(id);
  };
  return (
    <div>
      <p className="border-b px-4 py-3 text-xs text-muted-foreground">
        Schemes are named colour recipes for sections. Name them by where they’re used (“Hero band”, “Footer”) so they’re easy to pick later.
      </p>
      <div className="grid gap-2.5 p-3">
        {theme.schemes.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => nav.scheme(s.id)}
            className="group overflow-hidden rounded-xl border bg-background text-left transition hover:border-foreground/25 hover:shadow-sm"
          >
            <SchemePreview theme={theme} scheme={s.id} mode={previewMode} className="rounded-none" />
            <div className="flex items-center gap-2 border-t px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-[13px] font-medium">
                  {s.name}
                  {s.id === theme.defaultScheme && <span className="rounded bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground">Page default</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{s.description || <span className="italic">No description</span>}</p>
              </div>
            </div>
          </button>
        ))}
        <Button variant="outline" className="h-9 gap-1.5 border-dashed text-[13px]" onClick={add}>
          <Plus className="size-4" /> Add scheme
        </Button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ detail ---

export function SchemeDetail({
  theme,
  scheme,
  update,
  report,
  mode,
  setMode,
  focusRole,
  nav,
}: {
  theme: Theme;
  scheme: Scheme;
  update: (fn: (t: Theme) => Theme, key?: string) => void;
  report: DoctorReport;
  mode: Mode;
  setMode: (m: Mode) => void;
  focusRole?: string;
  nav: ThemeNav;
}) {
  const modes = modesOf(theme);
  const m: Mode = modes.includes(mode) ? mode : modes[0]!;
  const map: RoleMap | undefined = scheme[m] ?? scheme[m === "light" ? "dark" : "light"];
  const inherited = !scheme[m];

  const setScheme = (patch: Partial<Scheme>, key?: string) =>
    update((t) => ({ ...t, schemes: t.schemes.map((s) => (s.id === scheme.id ? { ...s, ...patch } : s)) }), key);

  const setRole = (role: Role, ref: RoleRef | undefined, key?: string) => {
    const base = { ...(map ?? ({} as RoleMap)) } as Record<string, RoleRef | undefined>;
    if (ref === undefined) delete base[role];
    else base[role] = ref;
    setScheme({ [m]: base as RoleMap }, key);
  };

  const pairsFor = (role: Role) => report.contrast.filter((c) => c.scheme === scheme.id && c.mode === m && c.fg === role);

  return (
    <div>
      <div className="space-y-3 border-b p-4">
        <SchemePreview theme={theme} scheme={scheme.id} mode={m} size="lg" className="ring-1 ring-border" />
        {modes.length > 1 && (
          <ToggleGroup type="single" variant="outline" size="sm" value={m} onValueChange={(v) => v && setMode(v as Mode)} className="w-full">
            <ToggleGroupItem value="light" className="flex-1 gap-1.5 text-xs"><Sun className="size-3.5" /> Light</ToggleGroupItem>
            <ToggleGroupItem value="dark" className="flex-1 gap-1.5 text-xs"><Moon className="size-3.5" /> Dark</ToggleGroupItem>
          </ToggleGroup>
        )}
        {inherited && (
          <p className="flex items-start gap-1.5 rounded-md bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-px size-3.5 shrink-0" /> No {m} colours yet, so it reuses the other mode. Any change below creates the {m} version.
          </p>
        )}
      </div>

      <Group title="Details">
        <Field label="Name" htmlFor={`sc-name-${scheme.id}`}>
          <Input id={`sc-name-${scheme.id}`} className="h-8 text-[13px]" value={scheme.name} onChange={(e) => setScheme({ name: e.target.value }, `sname:${scheme.id}`)} />
        </Field>
        <Field label="Where it’s used" htmlFor={`sc-desc-${scheme.id}`}>
          <Textarea
            id={`sc-desc-${scheme.id}`}
            rows={2}
            className="min-h-0 resize-none text-[13px]"
            placeholder="e.g. Hero bands and the footer"
            value={scheme.description}
            onChange={(e) => setScheme({ description: e.target.value }, `sdesc:${scheme.id}`)}
          />
        </Field>
        <div className="flex items-center gap-2">
          {scheme.id === theme.defaultScheme ? (
            <span className="flex h-8 items-center gap-1.5 text-xs text-muted-foreground"><Star className="size-3.5 fill-current" /> Page default</span>
          ) : (
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => update((t) => ({ ...t, defaultScheme: scheme.id }))}>
              <Star className="size-3.5" /> Make page default
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="ml-auto size-8" aria-label="Scheme actions"><MoreHorizontal /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => {
                  const id = uniqueSlug(scheme.id, theme.schemes.map((s) => s.id));
                  update((t) => ({ ...t, schemes: [...t.schemes, { ...structuredClone(scheme), id, name: `${scheme.name} copy` }] }));
                  nav.scheme(id);
                }}
              >
                <Copy /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={scheme.id === theme.defaultScheme || theme.schemes.length <= 1}
                onSelect={() => {
                  update((t) => ({ ...t, schemes: t.schemes.filter((s) => s.id !== scheme.id) }));
                  nav.go("schemes");
                }}
              >
                <Trash2 /> Delete scheme
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Group>

      {roleGroups.map((g) => (
        <Group key={g.title} title={g.title}>
          <ul className="-mx-1 space-y-1">
            {g.roles.map((role) => (
              <RoleRow
                key={role}
                theme={theme}
                scheme={scheme}
                mode={m}
                role={role}
                refValue={map?.[role]}
                pairs={pairsFor(role)}
                highlight={focusRole === role}
                onChange={(ref, key) => setRole(role, ref, key)}
              />
            ))}
          </ul>
        </Group>
      ))}
    </div>
  );
}

function RoleRow({
  theme,
  scheme,
  mode,
  role,
  refValue,
  pairs,
  highlight,
  onChange,
}: {
  theme: Theme;
  scheme: Scheme;
  mode: Mode;
  role: Role;
  refValue: RoleRef | undefined;
  pairs: DoctorReport["contrast"];
  highlight: boolean;
  onChange: (ref: RoleRef | undefined, key?: string) => void;
}) {
  const ref = refValue ? normalizeRef(refValue) : undefined;
  const optional = (optionalRoles as readonly string[]).includes(role);
  const fallback = optional ? roleFallbacks[role as keyof typeof roleFallbacks] : undefined;
  const color = cssColor(resolveRoleColor(theme, scheme, mode, role));
  const worst = pairs.length ? pairs.reduce((a, b) => (b.ratio / b.min < a.ratio / a.min ? b : a)) : null;
  const hasMix = !!ref?.mix && Object.keys(ref.mix).length > 0;
  const el = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (highlight) el.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlight]);

  return (
    <li ref={el} className={cn("rounded-lg px-1 py-1", highlight && "animate-[pulse_1s_ease-in-out_2] bg-amber-500/10 ring-1 ring-amber-500/40")}>
      <div className="flex items-center gap-2">
        <Swatch color={color} className="size-6 rounded-md" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[13px] leading-tight font-medium">
            {describeRole(role)}
            {worst && (
              <span
                title={`${worst.ratio}:1 contrast, needs ${worst.min}:1`}
                className={cn(
                  "inline-flex items-center gap-0.5 rounded px-1 py-px font-mono text-[10px] tabular-nums",
                  worst.pass ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : worst.ratio < 3 ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                )}
              >
                {worst.pass ? <Check className="size-2.5" /> : <AlertTriangle className="size-2.5" />}
                {worst.ratio.toFixed(1)}
              </span>
            )}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">{roleHint[role]}</p>
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-1 pl-8">
        <TokenSelect
          theme={theme}
          value={ref?.token}
          ariaLabel={`${describeRole(role)} colour`}
          auto={fallback ? `Auto · from ${describeRole(fallback.role)}` : undefined}
          onChange={(token) => onChange(token ? (ref?.mix ? { token, mix: ref.mix } : token) : undefined)}
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn("relative size-8 shrink-0", hasMix && "text-primary")}
              disabled={!ref}
              aria-label="Adjust shade"
              title={ref ? "Adjust shade (lightness, saturation, opacity)" : "Pick a colour first"}
            >
              <SlidersHorizontal className="size-3.5" />
              {hasMix && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" />}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            <p className="mb-1 text-[13px] font-semibold">Adjust {describeRole(role).toLowerCase()}</p>
            <p className="mb-3 text-xs text-muted-foreground">Tweaks apply only here; the palette colour stays the same.</p>
            {ref && <MixEditor mix={ref.mix} onChange={(mix) => onChange(mix ? { token: ref.token, mix } : ref.token, `mix:${scheme.id}:${mode}:${role}`)} />}
          </PopoverContent>
        </Popover>
      </div>
    </li>
  );
}

export const contrastLabel = (fg: Role, bg: Role) => contrastPairs.find((p) => p.fg === fg && p.bg === bg)?.label ?? `${fg} on ${bg}`;
