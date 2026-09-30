import type { SchemeSwatch, ThemeSummary } from "@/lib/theme-summary";
import { cn } from "@peltier/shared/utils";

/** Miniature "page" drawn from the theme's schemes – a cheap, zero-JS preview. */
export function ThemeMiniature({ theme, className }: { theme: ThemeSummary; className?: string }) {
  const [a, b = a, c = b] = theme.schemes;
  if (!a) return null;
  const font = theme.fonts[0];
  return (
    <div className={cn("overflow-hidden rounded-lg border shadow-sm", className)} style={{ fontFamily: font ? `"${font}", sans-serif` : undefined }}>
      <div className="flex items-center gap-1.5 px-3 py-2" style={{ background: a.background, color: a.text }}>
        <span className="size-2 rounded-full" style={{ background: a.primary }} />
        <span className="h-1.5 w-10 rounded-full opacity-70" style={{ background: a.text }} />
        <span className="ml-auto flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-1.5 w-5 rounded-full opacity-40" style={{ background: a.text }} />
          ))}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-3 px-4 py-5" style={{ background: b.background, color: b.text }}>
        <div className="col-span-3 space-y-1.5">
          <div className="h-2.5 w-11/12 rounded-sm" style={{ background: b.text }} />
          <div className="h-2.5 w-2/3 rounded-sm" style={{ background: b.text }} />
          <div className="h-1.5 w-full rounded-full opacity-50" style={{ background: b.text }} />
          <div className="h-1.5 w-4/5 rounded-full opacity-50" style={{ background: b.text }} />
          <div className="flex gap-1.5 pt-1.5">
            <span className="h-3.5 w-12 rounded" style={{ background: b.primary }} />
            <span className="h-3.5 w-10 rounded border" style={{ borderColor: b.text, opacity: 0.5 }} />
          </div>
        </div>
        <div className="col-span-2 rounded-md" style={{ background: `linear-gradient(135deg, ${b.accent}, ${b.primary})` }} />
      </div>
      <div className="grid grid-cols-3 gap-2 px-4 py-3" style={{ background: c.background }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-1">
            <div className="aspect-[4/3] rounded" style={{ background: c.text, opacity: 0.12 }} />
            <div className="h-1.5 w-3/4 rounded-full opacity-60" style={{ background: c.text }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SchemeChip({ scheme, className }: { scheme: SchemeSwatch; className?: string }) {
  return (
    <div className={cn("group flex min-w-0 items-center gap-2.5 rounded-lg border p-1.5 pr-3", className)} title={scheme.description || scheme.name}>
      <div className="grid size-9 shrink-0 place-items-center rounded-md border text-[13px] font-semibold" style={{ background: scheme.background, color: scheme.text }}>
        Aa
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{scheme.name}</p>
        <div className="mt-1 flex gap-1">
          {[scheme.background, scheme.text, scheme.primary, scheme.accent].map((c, i) => (
            <span key={i} className="size-2.5 rounded-full ring-1 ring-black/10" style={{ background: c }} />
          ))}
        </div>
      </div>
    </div>
  );
}
