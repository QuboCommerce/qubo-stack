"use client";

import { renameToken, tokenGroups, usedBy, type PaletteToken, type Theme, type TokenGroup } from "@qubo/stylekit";
import { cn } from "@qubo/shared/utils";
import { ChevronDown, Lock, LockOpen, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ColorEditor, Field, Group, Swatch, tokenColor, uniqueSlug } from "./controls";
import type { ThemeNav } from "./theme-panel";

const groupLabel: Record<TokenGroup, { label: string; hint: string }> = {
  brand: { label: "Brand", hint: "The colours people recognise you by." },
  accent: { label: "Accent", hint: "Highlights, badges, illustrations." },
  neutral: { label: "Neutrals", hint: "Backgrounds, text, borders." },
  feedback: { label: "Feedback", hint: "Success, warning, error." },
  custom: { label: "Other", hint: "" },
};

const roleLabel: Record<string, string> = {
  background: "Background",
  backgroundAlt: "Alt background",
  surface: "Cards",
  onSurface: "Card text",
  text: "Text",
  textMuted: "Muted text",
  heading: "Headings",
  primary: "Primary button",
  onPrimary: "Primary label",
  secondary: "Secondary button",
  onSecondary: "Secondary label",
  accent: "Accent",
  onAccent: "Text on accent",
  accentText: "Accent text",
  link: "Links",
  border: "Borders",
  focusRing: "Focus ring",
};
export const describeRole = (role: string) => roleLabel[role] ?? role;

export function PalettePage({
  theme,
  update,
  builder,
  nav,
  focusToken,
}: {
  theme: Theme;
  update: (fn: (t: Theme) => Theme, key?: string) => void;
  builder: boolean;
  nav: ThemeNav;
  focusToken?: string;
}) {
  const [open, setOpen] = useState<string | null>(focusToken ?? null);
  useEffect(() => {
    if (focusToken) setOpen(focusToken);
  }, [focusToken]);

  const setToken = (id: string, patch: Partial<PaletteToken>, key?: string) =>
    update((t) => ({ ...t, palette: t.palette.map((p) => (p.id === id ? { ...p, ...patch } : p)) }), key);

  const add = (group: TokenGroup) => {
    const id = uniqueSlug("new-colour", theme.palette.map((p) => p.id));
    update((t) => ({ ...t, palette: [...t.palette, { id, name: "New colour", description: "", group, locked: false, value: "oklch(0.7 0.1 250)" }] }));
    setOpen(id);
  };

  const groups = tokenGroups.filter((g) => g !== "custom" || theme.palette.some((p) => p.group === "custom"));

  return (
    <div>
      <p className="border-b px-4 py-3 text-xs text-muted-foreground">
        Every colour on the site comes from this palette. Schemes point at these colours by name, so changing one here updates every place it’s used.
      </p>
      {groups.map((g) => {
        const tokens = theme.palette.filter((p) => p.group === g);
        return (
          <Group
            key={g}
            title={groupLabel[g].label}
            description={groupLabel[g].hint || undefined}
            action={
              <Button variant="ghost" size="sm" className="-mr-2 -mt-1 h-7 gap-1 px-2 text-xs" onClick={() => add(g)}>
                <Plus className="size-3.5" /> Add
              </Button>
            }
          >
            {tokens.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No {groupLabel[g].label.toLowerCase()} colours.</p>
            ) : (
              <ul className="-mx-2 space-y-0.5">
                {tokens.map((token) => (
                  <TokenRow
                    key={token.id}
                    theme={theme}
                    token={token}
                    open={open === token.id}
                    onToggle={() => setOpen(open === token.id ? null : token.id)}
                    setToken={setToken}
                    update={update}
                    builder={builder}
                    nav={nav}
                    onRenamed={(id) => setOpen(id)}
                  />
                ))}
              </ul>
            )}
          </Group>
        );
      })}
    </div>
  );
}

function TokenRow({
  theme,
  token,
  open,
  onToggle,
  setToken,
  update,
  builder,
  nav,
  onRenamed,
}: {
  theme: Theme;
  token: PaletteToken;
  open: boolean;
  onToggle: () => void;
  setToken: (id: string, patch: Partial<PaletteToken>, key?: string) => void;
  update: (fn: (t: Theme) => Theme, key?: string) => void;
  builder: boolean;
  nav: ThemeNav;
  onRenamed: (id: string) => void;
}) {
  const uses = usedBy(theme, token.id);
  const editable = builder || !token.locked;
  const ref = useRef<HTMLLIElement>(null);
  const [idDraft, setIdDraft] = useState(token.id);
  useEffect(() => setIdDraft(token.id), [token.id]);
  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open]);

  const schemes = new Map(theme.schemes.map((s) => [s.id, s.name]));
  const byScheme = new Map<string, { mode: string; role: string }[]>();
  for (const u of uses) {
    const list = byScheme.get(u.schemeId) ?? [];
    list.push({ mode: u.mode, role: u.role });
    byScheme.set(u.schemeId, list);
  }

  return (
    <li ref={ref} className={cn("rounded-lg transition-colors", open ? "bg-muted/60 ring-1 ring-border" : "hover:bg-muted/50")}>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-2.5 px-2 py-1.5 text-left" aria-expanded={open}>
        <Swatch color={tokenColor(token)} className="size-7 rounded-md" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-[13px] font-medium">
            <span className="truncate">{token.name}</span>
            {token.locked && <Lock className="size-3 shrink-0 text-muted-foreground" aria-label="Locked brand colour" />}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {token.description || <span className="italic">No description</span>}
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums ring-1 ring-border" title="Places using this colour">
          {uses.length}
        </span>
        <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-4 px-2 pt-1 pb-3">
          {!editable && (
            <p className="flex items-center gap-1.5 rounded-md bg-background px-2 py-1.5 text-xs text-muted-foreground ring-1 ring-border">
              <Lock className="size-3" /> Brand colour, locked by your site builder.
            </p>
          )}
          <ColorEditor value={token.value} disabled={!editable} onChange={(value) => setToken(token.id, { value }, `color:${token.id}`)} />

          <Field label="Name" htmlFor={`tk-name-${token.id}`}>
            <Input id={`tk-name-${token.id}`} className="h-8 text-[13px]" value={token.name} onChange={(e) => setToken(token.id, { name: e.target.value }, `name:${token.id}`)} />
          </Field>
          <Field label="What it’s for" htmlFor={`tk-desc-${token.id}`}>
            <Textarea
              id={`tk-desc-${token.id}`}
              rows={2}
              className="min-h-0 resize-none text-[13px]"
              placeholder="e.g. Primary buttons and links on light backgrounds"
              value={token.description}
              onChange={(e) => setToken(token.id, { description: e.target.value }, `desc:${token.id}`)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Group">
              <Select value={token.group} onValueChange={(v) => setToken(token.id, { group: v as TokenGroup })}>
                <SelectTrigger size="sm" className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {tokenGroups.map((g) => (
                    <SelectItem key={g} value={g} className="text-xs">{groupLabel[g].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {builder && (
              <Field label="Lock">
                <div className="flex h-8 items-center gap-2">
                  <Switch checked={token.locked} onCheckedChange={(locked) => setToken(token.id, { locked })} aria-label="Lock brand colour" />
                  {token.locked ? <Lock className="size-3.5 text-muted-foreground" /> : <LockOpen className="size-3.5 text-muted-foreground" />}
                </div>
              </Field>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-[13px] font-medium">Used by</p>
            {uses.length === 0 ? (
              <p className="text-xs text-muted-foreground">Not used yet. Assign it to a role in a scheme.</p>
            ) : (
              <ul className="space-y-1">
                {[...byScheme].map(([schemeId, list]) => (
                  <li key={schemeId}>
                    {schemeId.startsWith("shadow:") ? (
                      <span className="text-xs text-muted-foreground">Shadow · {theme.shape.shadows.find((s) => `shadow:${s.id}` === schemeId)?.name}</span>
                    ) : (
                      <button type="button" className="group w-full rounded-md px-1.5 py-1 text-left hover:bg-background" onClick={() => nav.scheme(schemeId, list[0]!.mode as "light" | "dark", list[0]!.role)}>
                        <span className="block text-xs font-medium group-hover:underline">{schemes.get(schemeId) ?? schemeId}</span>
                        <span className="flex flex-wrap gap-1 pt-0.5">
                          {list.map((u) => (
                            <span key={`${u.mode}-${u.role}`} className="rounded bg-background px-1.5 py-px text-[10px] text-muted-foreground ring-1 ring-border">
                              {describeRole(u.role)}
                              {theme.modeStrategy === "dual" && <span className="opacity-60"> · {u.mode}</span>}
                            </span>
                          ))}
                        </span>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {builder && (
            <div className="flex items-end gap-2 border-t pt-3">
              <Field label="Token id" hint="Used in CSS as a variable name. Renaming updates every reference.">
                <Input
                  className="h-8 font-mono text-xs"
                  value={idDraft}
                  onChange={(e) => setIdDraft(e.target.value.toLowerCase())}
                  onBlur={() => {
                    if (idDraft === token.id) return;
                    if (!/^[a-z][a-z0-9-]*$/.test(idDraft)) {
                      toast.error("Ids use lowercase letters, digits and dashes.");
                      return setIdDraft(token.id);
                    }
                    try {
                      update((t) => renameToken(t, token.id, idDraft));
                      onRenamed(idDraft);
                    } catch (e) {
                      toast.error((e as Error).message);
                      setIdDraft(token.id);
                    }
                  }}
                />
              </Field>
            </div>
          )}
          {editable && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-center gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={uses.length > 0 || theme.palette.length <= 1}
              title={uses.length ? "Remove it from every scheme first" : undefined}
              onClick={() => update((t) => ({ ...t, palette: t.palette.filter((p) => p.id !== token.id) }))}
            >
              <Trash2 className="size-3.5" /> {uses.length ? `In use in ${uses.length} place${uses.length === 1 ? "" : "s"}` : "Delete colour"}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
