"use client";

import { contrastPairs, type DoctorReport, type Finding, type Mode, type Theme } from "@qubo/stylekit";
import { cn } from "@qubo/shared/utils";
import { AlertCircle, AlertTriangle, ArrowRight, Check, Info } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Group } from "./controls";
import { useRoleLabel } from "./use-labels";
import { modesOf } from "./schemes";
import type { ThemeNav } from "./theme-panel";

export const healthTone = (h: number) => (h >= 90 ? "text-emerald-600" : h >= 70 ? "text-amber-600" : "text-destructive");

/** Circular health gauge (0–100). */
export function HealthRing({ value, size = 44, className }: { value: number; size?: number; className?: string }) {
  const t = useTranslations("studio.theme.doctor");
  const r = (size - 5) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className={cn("relative inline-grid shrink-0 place-items-center", healthTone(value), className)} style={{ width: size, height: size }} title={t("healthTitle", { value })}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.15} strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} className="transition-[stroke-dashoffset] duration-500" />
      </svg>
      <span className="absolute font-semibold tabular-nums" style={{ fontSize: size * 0.3 }}>{value}</span>
    </span>
  );
}

const severityMeta = {
  error: { icon: AlertCircle, tone: "text-destructive" },
  warning: { icon: AlertTriangle, tone: "text-amber-600" },
  info: { icon: Info, tone: "text-muted-foreground" },
} as const;

export function findingTarget(f: Finding): string | null {
  if (f.scheme) return "scheme";
  if (f.token) return "palette";
  return null;
}

export function DoctorPage({ theme, report, nav, mode }: { theme: Theme; report: DoctorReport; nav: ThemeNav; mode: Mode }) {
  const t = useTranslations("studio.theme.doctor");
  const roleLabel = useRoleLabel();
  const counts = { error: 0, warning: 0, info: 0 };
  for (const f of report.findings) counts[f.severity]++;
  const modes = modesOf(theme);
  const [gridMode, setGridMode] = useState<Mode>(modes.includes(mode) ? mode : modes[0]!);

  const fix = (f: Finding) => {
    if (f.scheme && theme.schemes.some((s) => s.id === f.scheme)) nav.scheme(f.scheme, f.mode, f.role);
    else if (f.token) nav.token(f.token);
  };

  return (
    <div>
      <div className="flex items-center gap-4 border-b p-4">
        <HealthRing value={report.health} size={64} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">
            {report.health >= 90 ? t("healthy") : report.health >= 70 ? t("needsAttention") : t("unhealthy")}
          </p>
          <p className="text-xs text-muted-foreground">{t("scoreHint")}</p>
          <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
            {t(`tiers.${report.richness.tier}.label`)} · {report.richness.score}
          </p>
        </div>
      </div>
      <p className="border-b px-4 py-2.5 text-xs text-muted-foreground">{t("richnessNote", { hint: t(`tiers.${report.richness.tier}.hint`) })}</p>

      {(["error", "warning", "info"] as const).map((sev) => {
        const list = report.findings.filter((f) => f.severity === sev);
        if (!list.length) return null;
        const M = severityMeta[sev];
        return (
          <Group key={sev} title={t(`severity.${sev}`, { count: list.length })}>
            <ul className="-mx-2 space-y-0.5">
              {list.map((f, i) => {
                const target = findingTarget(f);
                return (
                  <li key={i}>
                    <button
                      type="button"
                      disabled={!target}
                      onClick={() => fix(f)}
                      className="group flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left enabled:hover:bg-muted"
                    >
                      <M.icon className={cn("mt-0.5 size-3.5 shrink-0", M.tone)} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs">{f.message}</span>
                        {f.hint && <span className="block text-[11px] text-muted-foreground">{f.hint}</span>}
                      </span>
                      {target && <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Group>
        );
      })}
      {counts.error + counts.warning + counts.info === 0 && (
        <p className="flex items-center gap-2 border-b px-4 py-4 text-[13px] text-emerald-700"><Check className="size-4" /> {t("noFindings")}</p>
      )}

      <Group
        title={t("gridTitle")}
        description={t("gridDescription")}
        action={
          modes.length > 1 ? (
            <ToggleGroup type="single" size="sm" variant="outline" value={gridMode} onValueChange={(v) => v && setGridMode(v as Mode)} className="-mt-1">
              <ToggleGroupItem value="light" className="h-6 px-2 text-[11px]">{t("light")}</ToggleGroupItem>
              <ToggleGroupItem value="dark" className="h-6 px-2 text-[11px]">{t("dark")}</ToggleGroupItem>
            </ToggleGroup>
          ) : undefined
        }
      >
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full border-separate border-spacing-0.5 text-[11px]">
            <thead>
              <tr>
                <th className="text-left font-medium text-muted-foreground" />
                {theme.schemes.map((s) => (
                  <th key={s.id} className="max-w-16 truncate px-0.5 text-center font-medium text-muted-foreground" title={s.name}>
                    {s.name.split(" ")[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contrastPairs.map((p) => {
                const cells = theme.schemes.map((s) => report.contrast.find((c) => c.scheme === s.id && c.mode === gridMode && c.fg === p.fg && c.bg === p.bg));
                if (cells.every((c) => !c)) return null;
                return (
                  <tr key={`${p.fg}-${p.bg}`}>
                    <td className="max-w-24 truncate pr-1 text-muted-foreground" title={p.label}>{roleLabel(p.fg)}</td>
                    {cells.map((c, i) => (
                      <td key={i} className="p-0">
                        {c ? (
                          <button
                            type="button"
                            onClick={() => nav.scheme(theme.schemes[i]!.id, gridMode, p.fg)}
                            title={t("contrastTitle", { label: p.label, ratio: c.ratio, min: c.min })}
                            className={cn(
                              "w-full rounded px-1 py-1 text-center font-mono tabular-nums transition-opacity hover:opacity-80",
                              c.pass ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : c.ratio < 3 ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                            )}
                          >
                            {c.ratio.toFixed(1)}
                          </button>
                        ) : (
                          <span className="block text-center text-muted-foreground/40">·</span>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Group>
    </div>
  );
}
