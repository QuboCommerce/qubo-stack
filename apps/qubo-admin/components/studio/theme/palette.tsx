"use client";

import { renameToken, tokenGroups, usedBy, type PaletteToken, type Theme, type TokenGroup } from "@qubo/stylekit";
import { cn } from "@qubo/shared/utils";
import { ChevronDown, Lock, LockOpen, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ColorEditor, Field, Group, Swatch, tokenColor, uniqueSlug } from "./controls";
import type { ThemeNav } from "./theme-panel";
import { useRoleLabel } from "./use-labels";

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
  const t = useTranslations("studio.theme.palette");
  const [open, setOpen] = useState<string | null>(focusToken ?? null);
  useEffect(() => {
    if (focusToken) setOpen(focusToken);
  }, [focusToken]);

  const setToken = (id: string, patch: Partial<PaletteToken>, key?: string) =>
    update((th) => ({ ...th, palette: th.palette.map((p) => (p.id === id ? { ...p, ...patch } : p)) }), key);

  const add = (group: TokenGroup) => {
    const id = uniqueSlug("new-colour", theme.palette.map((p) => p.id));
    update((th) => ({ ...th, palette: [...th.palette, { id, name: t("newName"), description: "", group, locked: false, value: "oklch(0.7 0.1 250)" }] }));
    setOpen(id);
  };

  const groups = tokenGroups.filter((g) => g !== "custom" || theme.palette.some((p) => p.group === "custom"));

  return (
    <div>
      <p className="border-b px-4 py-3 text-xs text-muted-foreground">
        {t("intro")}
      </p>
      {groups.map((g) => {
        const tokens = theme.palette.filter((p) => p.group === g);
        return (
          <Group
            key={g}
            title={t(`groups.${g}.label`)}
            description={g === "custom" ? undefined : t(`groups.${g}.hint`)}
            action={
              <Button variant="ghost" size="sm" className="-mr-2 -mt-1 h-7 gap-1 px-2 text-xs" onClick={() => add(g)}>
                <Plus className="size-3.5" /> {t("add")}
              </Button>
            }
          >
            {tokens.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">{t("empty")}</p>
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
  const t = useTranslations("studio.theme.palette");
  const roleLabel = useRoleLabel();
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
            {token.locked && <Lock className="size-3 shrink-0 text-muted-foreground" aria-label={t("lockedLabel")} />}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {token.description || <span className="italic">{t("noDescription")}</span>}
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums ring-1 ring-border" title={t("usesTitle")}>
          {uses.length}
        </span>
        <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-4 px-2 pt-1 pb-3">
          {!editable && (
            <p className="flex items-center gap-1.5 rounded-md bg-background px-2 py-1.5 text-xs text-muted-foreground ring-1 ring-border">
              <Lock className="size-3" /> {t("lockedNote")}
            </p>
          )}
          <ColorEditor value={token.value} disabled={!editable} onChange={(value) => setToken(token.id, { value }, `color:${token.id}`)} />

          <Field label={t("name")} htmlFor={`tk-name-${token.id}`}>
            <Input id={`tk-name-${token.id}`} className="h-8 text-[13px]" value={token.name} onChange={(e) => setToken(token.id, { name: e.target.value }, `name:${token.id}`)} />
          </Field>
          <Field label={t("purpose")} htmlFor={`tk-desc-${token.id}`}>
            <Textarea
              id={`tk-desc-${token.id}`}
              rows={2}
              className="min-h-0 resize-none text-[13px]"
              placeholder={t("purposePlaceholder")}
              value={token.description}
              onChange={(e) => setToken(token.id, { description: e.target.value }, `desc:${token.id}`)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("group")}>
              <Select value={token.group} onValueChange={(v) => setToken(token.id, { group: v as TokenGroup })}>
                <SelectTrigger size="sm" className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {tokenGroups.map((g) => (
                    <SelectItem key={g} value={g} className="text-xs">{t(`groups.${g}.label`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {builder && (
              <Field label={t("lock")}>
                <div className="flex h-8 items-center gap-2">
                  <Switch checked={token.locked} onCheckedChange={(locked) => setToken(token.id, { locked })} aria-label={t("lockSwitch")} />
                  {token.locked ? <Lock className="size-3.5 text-muted-foreground" /> : <LockOpen className="size-3.5 text-muted-foreground" />}
                </div>
              </Field>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-[13px] font-medium">{t("usedBy")}</p>
            {uses.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("unused")}</p>
            ) : (
              <ul className="space-y-1">
                {[...byScheme].map(([schemeId, list]) => (
                  <li key={schemeId}>
                    {schemeId.startsWith("shadow:") ? (
                      <span className="text-xs text-muted-foreground">{t("shadow")} · {theme.shape.shadows.find((s) => `shadow:${s.id}` === schemeId)?.name}</span>
                    ) : (
                      <button type="button" className="group w-full rounded-md px-1.5 py-1 text-left hover:bg-background" onClick={() => nav.scheme(schemeId, list[0]!.mode as "light" | "dark", list[0]!.role)}>
                        <span className="block text-xs font-medium group-hover:underline">{schemes.get(schemeId) ?? schemeId}</span>
                        <span className="flex flex-wrap gap-1 pt-0.5">
                          {list.map((u) => (
                            <span key={`${u.mode}-${u.role}`} className="rounded bg-background px-1.5 py-px text-[10px] text-muted-foreground ring-1 ring-border">
                              {roleLabel(u.role)}
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
              <Field label={t("tokenId")} hint={t("tokenIdHint")}>
                <Input
                  className="h-8 font-mono text-xs"
                  value={idDraft}
                  onChange={(e) => setIdDraft(e.target.value.toLowerCase())}
                  onBlur={() => {
                    if (idDraft === token.id) return;
                    if (!/^[a-z][a-z0-9-]*$/.test(idDraft)) {
                      toast.error(t("idInvalid"));
                      return setIdDraft(token.id);
                    }
                    try {
                      update((th) => renameToken(th, token.id, idDraft));
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
              title={uses.length ? t("removeFirst") : undefined}
              onClick={() => update((th) => ({ ...th, palette: th.palette.filter((p) => p.id !== token.id) }))}
            >
              <Trash2 className="size-3.5" /> {uses.length ? t("inUse", { count: uses.length }) : t("delete")}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
