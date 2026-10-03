import Link from "next/link";
import { builtInThemes } from "@qubo/stylekit";
import { cn } from "@qubo/shared/utils";

/** Chips that swap the preview theme via `?theme=` (server-rendered, no JS). */
export function ThemeSwitch({ href, active }: { href: (theme?: string) => string; active?: string }) {
  const chips = [{ id: undefined as string | undefined, name: "Site theme" }, ...Object.values(builtInThemes).map((t) => ({ id: t.id, name: t.name }))];
  return (
    <div className="flex gap-1 overflow-x-auto">
      {chips.map((c) => (
        <Link
          key={c.id ?? "site"}
          href={href(c.id)}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            (active ?? undefined) === c.id ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          {c.name}
        </Link>
      ))}
    </div>
  );
}
