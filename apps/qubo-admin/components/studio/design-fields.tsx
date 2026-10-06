"use client";

import { createUsePuck, FieldLabel, type Field } from "@puckeditor/core";
import { decorRanges, DecorMark, getPath, hashText, presetEmptyOptions, presetList, ThemeStyles, type DecorRange, type DecorValue, type FieldAdapters } from "@qubo/blocks";
import { formatOklch, resolveRoleColor, type Gradient, type Mode, type Theme } from "@qubo/stylekit";
import { cn } from "@qubo/shared/utils";
import { AlertTriangle, Highlighter, Loader2 } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { localeTextsAction, type LocaleText } from "@/app/studio-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DurationField, EasingField } from "./theme/design-controls";
import { ThemeScope } from "./theme/preview";

const usePuck = createUsePuck();
const NONE = "__none";
const themeMode = (theme: Theme | undefined): Mode => (theme?.modeStrategy === "dark" ? "dark" : "light");

// ------------------------------------------------------- duration, easing ---

export const durationFieldAdapter: NonNullable<FieldAdapters["duration"]> = (def) =>
  ({
    type: "custom",
    label: def.meta.label,
    render: ({ value, onChange, readOnly }) => (
      <div className={cn(readOnly && "pointer-events-none opacity-60")}>
        <DurationField label={def.meta.label} value={typeof value === "number" ? value : def.default} min={def.min} max={def.max} hint={def.meta.description} onChange={onChange} />
      </div>
    ),
  }) satisfies Field;

export const easingFieldAdapter: NonNullable<FieldAdapters["easing"]> = (def) =>
  ({
    type: "custom",
    label: def.meta.label,
    render: ({ value, onChange, readOnly }) => (
      <div className={cn(readOnly && "pointer-events-none opacity-60")}>
        <EasingField label={def.meta.label} value={typeof value === "string" ? value : ""} onChange={onChange} />
      </div>
    ),
  }) satisfies Field;

// ------------------------------------------------------------------ preset ---

/** Concrete CSS for a gradient in the default scheme (the sidebar is outside the themed canvas). */
function gradientPreview(theme: Theme, g: Gradient): string {
  const scheme = theme.schemes.find((s) => s.id === theme.defaultScheme) ?? theme.schemes[0]!;
  const stops = g.stops
    .map((s) => {
      const c = resolveRoleColor(theme, scheme, themeMode(theme), s.role);
      return `${c ? formatOklch({ ...c, alpha: s.alpha }) : "transparent"} ${s.at}%`;
    })
    .join(", ");
  if (g.kind === "radial") return `radial-gradient(circle at ${g.x}% ${g.y}%, ${stops})`;
  if (g.kind === "conic") return `conic-gradient(from ${g.angle}deg at ${g.x}% ${g.y}%, ${stops})`;
  return `linear-gradient(${g.angle}deg, ${stops})`;
}

export const presetFieldAdapter: NonNullable<FieldAdapters["preset"]> = (def, ctx) =>
  ({
    type: "custom",
    label: def.meta.label,
    render: ({ value, onChange, readOnly, id }) => {
      const items = presetList(def.preset, ctx.theme);
      const current = typeof value === "string" ? value : "";
      const leading = presetEmptyOptions(def.empty);
      const missing = current && !items.some((i) => i.id === current) && !leading.some((o) => o.value === current);
      return (
        <FieldLabel label={def.meta.label} el="div" readOnly={readOnly}>
          <Select value={current || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)} disabled={readOnly}>
            <SelectTrigger id={id} size="sm" className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
            <SelectContent position="popper" className="max-h-80">
              {leading.map((o) => (
                <SelectItem key={o.value || NONE} value={o.value || NONE} className="text-xs">{o.label}</SelectItem>
              ))}
              {missing && <SelectItem value={current} className="text-xs text-destructive">Missing “{current}”</SelectItem>}
              {items.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  <span className="flex items-center gap-2">
                    {def.preset === "gradient" && ctx.theme && (
                      <span className="size-4 shrink-0 rounded-sm ring-1 ring-border" style={{ background: gradientPreview(ctx.theme, p as Gradient) }} />
                    )}
                    {p.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {def.meta.description && <p className="mt-1 text-xs text-muted-foreground">{def.meta.description}</p>}
        </FieldLabel>
      );
    },
  }) satisfies Field;

// ------------------------------------------------------------------- decor ---

type Word = { start: number; end: number; text: string };

function wordsOf(text: string, locale: string): Word[] {
  const seg = new Intl.Segmenter(locale, { granularity: "word" });
  const out: Word[] = [];
  for (const s of seg.segment(text)) if (s.isWordLike) out.push({ start: s.index, end: s.index + s.segment.length, text: s.segment });
  return out;
}

/** Consecutive picked words become one range, so a box or circle wraps the whole phrase. */
function rangesFromPicks(words: Word[], picked: Set<number>): [number, number][] {
  const out: [number, number][] = [];
  let open: [number, number] | null = null;
  words.forEach((w, i) => {
    if (picked.has(i)) {
      if (open && picked.has(i - 1)) open[1] = w.end;
      else {
        open = [w.start, w.end];
        out.push(open);
      }
    }
  });
  return out;
}

function picksFromRanges(words: Word[], at: [number, number][]): Set<number> {
  const s = new Set<number>();
  words.forEach((w, i) => {
    if (at.some(([a, b]) => w.start < b && w.end > a)) s.add(i);
  });
  return s;
}

function normalizeDecor(v: unknown): DecorValue {
  const o = (v && typeof v === "object" ? v : {}) as Partial<DecorValue>;
  return { preset: o.preset ?? "", match: o.match ?? "", ranges: Array.isArray(o.ranges) ? o.ranges : [] };
}

/** Text with the real decor mark applied, for previews. */
function DecoratedPreview({ theme, text, value }: { theme: Theme; text: string; value: DecorValue }) {
  const preset = theme.decor.find((d) => d.id === value.preset);
  const at = preset ? decorRanges(text, value) : [];
  const parts: React.ReactNode[] = [];
  let i = 0;
  at.forEach(([a, b], k) => {
    if (a > i) parts.push(<Fragment key={`t${k}`}>{text.slice(i, a)}</Fragment>);
    parts.push(<DecorMark key={`d${k}`} preset={preset!}>{text.slice(a, b)}</DecorMark>);
    i = b;
  });
  if (i < text.length) parts.push(<Fragment key="tail">{text.slice(i)}</Fragment>);
  return <>{parts}</>;
}

/** Relative path of the decorated text, from Puck's field name ("items[0].decor" → "items.0.title"). */
function textPathFor(name: string, of: string): string {
  const parts = name.replace(/\[(\d+)\]/g, ".$1").split(".");
  parts.pop();
  return [...parts, of].join(".");
}

export function decorFieldAdapter(site: { slug: string; documentId: string }): NonNullable<FieldAdapters["decor"]> {
  return (def, ctx) =>
    ({
      type: "custom",
      label: def.meta.label,
      render: ({ value, onChange, readOnly, name }) => (
        <DecorField label={def.meta.label} of={def.of} name={name} theme={ctx.theme} site={site} value={normalizeDecor(value)} onChange={onChange} readOnly={readOnly} />
      ),
    }) satisfies Field;
}

function DecorField({
  label,
  of,
  name,
  theme,
  site,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  of: string;
  name: string;
  theme: Theme | undefined;
  site: { slug: string; documentId: string };
  value: DecorValue;
  onChange: (v: DecorValue) => void;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const path = textPathFor(name, of);
  const nodeId = usePuck((s) => (s.selectedItem?.props as { id?: string } | undefined)?.id ?? "");
  const text = usePuck((s) => {
    const v = s.selectedItem ? getPath(s.selectedItem.props, path) : undefined;
    return typeof v === "string" ? v : "";
  });
  const presets = theme?.decor ?? [];
  const at = decorRanges(text, value.preset ? value : { ...value, preset: "_" });
  const picked = at.map(([a, b]) => text.slice(a, b));
  const otherLanguages = value.ranges.filter((r) => r.hash !== hashText(text)).length;

  return (
    <FieldLabel label={label} el="div" readOnly={readOnly}>
      <div className="space-y-2">
        <Select value={value.preset || NONE} onValueChange={(v) => onChange({ ...value, preset: v === NONE ? "" : v })} disabled={readOnly}>
          <SelectTrigger size="sm" className="h-8 w-full text-xs" aria-label="Highlight style"><SelectValue /></SelectTrigger>
          <SelectContent position="popper" className="max-h-80">
            <SelectItem value={NONE} className="text-xs">No highlight</SelectItem>
            {presets.map((d) => <SelectItem key={d.id} value={d.id} className="text-xs">{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {value.preset && (
          <button
            type="button"
            disabled={readOnly || !text}
            onClick={() => setOpen(true)}
            className="flex w-full items-center gap-2 rounded-md border border-dashed px-2.5 py-2 text-left text-xs hover:bg-muted/50 disabled:opacity-50"
          >
            <Highlighter className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">
              {picked.length ? picked.map((p) => `“${p}”`).join(", ") : <span className="text-muted-foreground">Choose the words to highlight</span>}
            </span>
            {otherLanguages > 0 && <span className="shrink-0 rounded bg-muted px-1.5 py-px text-[10px] text-muted-foreground">+{otherLanguages}</span>}
          </button>
        )}
      </div>
      {open && theme && (
        <DecorDialog
          theme={theme}
          site={site}
          path={nodeId ? `${nodeId}.${path}` : ""}
          primaryText={text}
          value={value}
          onClose={() => setOpen(false)}
          onSave={(v) => {
            onChange(v);
            setOpen(false);
          }}
        />
      )}
    </FieldLabel>
  );
}

function DecorDialog({
  theme,
  site,
  path,
  primaryText,
  value,
  onClose,
  onSave,
}: {
  theme: Theme;
  site: { slug: string; documentId: string };
  path: string;
  primaryText: string;
  value: DecorValue;
  onClose: () => void;
  onSave: (v: DecorValue) => void;
}) {
  const [locales, setLocales] = useState<LocaleText[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DecorValue>(value);

  useEffect(() => {
    let live = true;
    void localeTextsAction(site.slug, { documentId: site.documentId, path }).then((res) => {
      if (!live) return;
      if (res.ok) setLocales(res.locales.map((l) => (l.primary ? { ...l, text: primaryText } : l)));
      else {
        setError(res.error);
        setLocales([{ locale: "en", label: "Main language", primary: true, text: primaryText, status: "source" }]);
      }
    });
    return () => {
      live = false;
    };
  }, [site.slug, site.documentId, path, primaryText]);

  const current = new Set((locales ?? []).flatMap((l) => (l.text ? [hashText(l.text)] : [])));
  const stale = locales ? draft.ranges.filter((r) => !current.has(r.hash)).length : 0;

  const setRangesFor = (text: string, at: [number, number][]) => {
    const hash = hashText(text);
    const rest = draft.ranges.filter((r) => r.hash !== hash);
    const next: DecorRange[] = at.length ? [...rest, { hash, at }] : rest;
    setDraft({ ...draft, ranges: next });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <ThemeStyles theme={theme} />
        <DialogHeader>
          <DialogTitle>Highlight words</DialogTitle>
          <DialogDescription>Click the words to mark in each language. Neighbouring words join into one mark.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium">Style</span>
          <Select value={draft.preset || NONE} onValueChange={(v) => setDraft({ ...draft, preset: v === NONE ? "" : v })}>
            <SelectTrigger size="sm" className="h-8 w-48 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE} className="text-xs">No highlight</SelectItem>
              {theme.decor.map((d) => <SelectItem key={d.id} value={d.id} className="text-xs">{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="-mx-1 max-h-[60dvh] space-y-3 overflow-y-auto px-1">
          {!locales ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading languages…</div>
          ) : (
            locales.map((l) => <LocaleRow key={l.locale} theme={theme} entry={l} value={draft} onPick={(text, at) => setRangesFor(text, at)} />)
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter className="items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {stale > 0 && (
              <button type="button" className="underline-offset-2 hover:underline" onClick={() => setDraft({ ...draft, ranges: draft.ranges.filter((r) => current.has(r.hash)) })}>
                Remove {stale} selection{stale === 1 ? "" : "s"} for old wording
              </button>
            )}
          </span>
          <span className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => onSave({ ...draft, match: draft.ranges.some((r) => r.hash === hashText(primaryText)) ? "" : draft.match })}>Save</Button>
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const statusNote: Partial<Record<LocaleText["status"], string>> = {
  stale: "Translation is out of date",
  draft: "Draft translation",
};

function LocaleRow({ theme, entry, value, onPick }: { theme: Theme; entry: LocaleText; value: DecorValue; onPick: (text: string, at: [number, number][]) => void }) {
  const text = entry.text ?? "";
  const words = useMemo(() => wordsOf(text, entry.locale), [text, entry.locale]);
  const own = value.ranges.find((r) => r.hash === hashText(text));
  const at = own ? own.at : decorRanges(text, { ...value, preset: value.preset || "_" });
  const picked = picksFromRanges(words, at);
  const toggle = (i: number) => {
    const next = new Set(picked);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    onPick(text, rangesFromPicks(words, next));
  };

  // Render words as buttons and keep the original spacing and punctuation between them.
  const pieces: React.ReactNode[] = [];
  let cursor = 0;
  words.forEach((w, i) => {
    if (w.start > cursor) pieces.push(<span key={`g${i}`}>{text.slice(cursor, w.start)}</span>);
    pieces.push(
      <button
        key={`w${i}`}
        type="button"
        aria-pressed={picked.has(i)}
        onClick={() => toggle(i)}
        className={cn(
          "rounded px-0.5 transition-colors",
          picked.has(i) ? "bg-primary text-primary-foreground" : "hover:bg-muted",
        )}
      >
        {w.text}
      </button>,
    );
    cursor = w.end;
  });
  if (cursor < text.length) pieces.push(<span key="tail">{text.slice(cursor)}</span>);

  return (
    <section className="rounded-lg border p-3">
      <header className="mb-2 flex items-center gap-2">
        <span className="text-[13px] font-medium">{entry.label}</span>
        <span className="font-mono text-[11px] text-muted-foreground">{entry.locale}</span>
        {entry.primary && <span className="rounded bg-muted px-1.5 py-px text-[10px] text-muted-foreground">Main</span>}
        {statusNote[entry.status] && (
          <span className="flex items-center gap-1 text-[11px] text-amber-600"><AlertTriangle className="size-3" />{statusNote[entry.status]}</span>
        )}
        {!own && at.length > 0 && <span className="text-[11px] text-muted-foreground">Matched by phrase</span>}
      </header>
      {entry.text === null ? (
        <p className="text-xs text-muted-foreground">Not translated yet. Pick words once the translation exists.</p>
      ) : (
        <>
          <p className="text-[15px] leading-relaxed">{pieces}</p>
          {value.preset && (
            <ThemeScope theme={theme} mode={themeMode(theme)} className="mt-2 rounded-md px-3 py-2.5" style={{ background: "var(--qb-background)" }}>
              <p className="qb-font-heading" style={{ fontSize: 22, lineHeight: 1.2, color: "var(--qb-heading)" }}>
                <DecoratedPreview theme={theme} text={text} value={value} />
              </p>
            </ThemeScope>
          )}
        </>
      )}
    </section>
  );
}
