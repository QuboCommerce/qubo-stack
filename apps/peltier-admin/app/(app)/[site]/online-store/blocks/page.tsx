import Link from "next/link";
import { Blocks, Lock, Search } from "lucide-react";
import { blockCategories, registry, type BlockCategory } from "@peltier/blocks";
import { builtInThemes } from "@peltier/stylekit";
import { BlockFrame } from "@/components/block-frame";
import { EmptyState, Page, Panel } from "@/components/page";
import { ThemeSwitch } from "@/components/theme-switch";
import { Badge } from "@/components/ui/badge";
import { requireSite } from "@/lib/admin";
import { cn } from "@peltier/shared/utils";

type Search = { q?: string; kind?: string; theme?: string };
const kinds = [
  { id: "all", label: "All" },
  { id: "section", label: "Sections" },
  { id: "layout", label: "Layout" },
  { id: "element", label: "Elements" },
];

export const metadata = { title: "Block library" };

export default async function BlockLibraryPage({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<Search> }) {
  const [{ site: slug }, sp] = await Promise.all([params, searchParams]);
  const { site } = await requireSite(slug);
  const caps = new Set<string>(site.capabilities ?? []);
  const theme = sp.theme && sp.theme in builtInThemes ? sp.theme : undefined;
  const kind = kinds.some((k) => k.id === sp.kind) ? sp.kind! : "all";
  const q = sp.q?.trim().toLowerCase();
  const base = `/${site.slug}/online-store/blocks`;
  const qs = (patch: Partial<Search>) => {
    const next = { q: sp.q, kind, theme, ...patch };
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v && !(k === "kind" && v === "all")) u.set(k, v);
    const s = u.toString();
    return s ? `${base}?${s}` : base;
  };

  const all = registry.list();
  const blocks = all.filter(
    (b) =>
      (kind === "all" || b.kind === kind) &&
      (!q || [b.name, b.label, b.description, ...(b.keywords ?? [])].join(" ").toLowerCase().includes(q)),
  );
  const byCategory = (Object.keys(blockCategories) as BlockCategory[])
    .map((c) => ({ id: c, label: blockCategories[c], blocks: blocks.filter((b) => b.category === c) }))
    .filter((g) => g.blocks.length);
  const counts = Object.fromEntries(kinds.map((k) => [k.id, k.id === "all" ? all.length : all.filter((b) => b.kind === k.id).length]));

  return (
    <Page
      title="Block library"
      subtitle={`${all.length} schema-first blocks · rendered live with ${theme ? builtInThemes[theme as keyof typeof builtInThemes].name : "your site theme"}`}
      width="full"
      className="max-w-[140rem]"
    >
      <Panel flush className="@container">
        <div className="flex flex-col gap-2 border-b p-2 @min-[56rem]:flex-row @min-[56rem]:items-center">
          <nav className="flex gap-0.5 overflow-x-auto">
            {kinds.map((k) => (
              <Link
                key={k.id}
                href={qs({ kind: k.id })}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium",
                  kind === k.id ? "bg-accent" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                {k.label} <span className="text-xs tabular-nums text-muted-foreground">{counts[k.id]}</span>
              </Link>
            ))}
          </nav>
          <form action={base} className="relative @min-[56rem]:ml-auto @min-[56rem]:w-72">
            {kind !== "all" && <input type="hidden" name="kind" value={kind} />}
            {theme && <input type="hidden" name="theme" value={theme} />}
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input name="q" defaultValue={sp.q} placeholder="Search blocks" className="h-8 w-full rounded-lg border bg-background pl-8 pr-3 text-[13px] outline-none focus:ring-2 focus:ring-ring/40" />
          </form>
        </div>
        <div className="border-b px-3 py-2">
          <ThemeSwitch href={(t) => qs({ theme: t })} active={theme} />
        </div>
      </Panel>

      {byCategory.length === 0 && (
        <Panel><EmptyState icon={Blocks} title="No blocks match" description="Try another search or filter." /></Panel>
      )}

      {byCategory.map((group) => (
        <section key={group.id} className="@container">
          <h2 className="mb-2 flex items-center gap-2 px-3 text-sm font-semibold xs:px-0">
            {group.label} <span className="text-xs font-normal text-muted-foreground">{group.blocks.length}</span>
          </h2>
          <div className="grid gap-3 @min-[34rem]:grid-cols-2 @min-[64rem]:grid-cols-3 @min-[96rem]:grid-cols-4 @min-[128rem]:grid-cols-5">
            {group.blocks.map((b) => {
              const missing = (b.requires ?? []).filter((c) => !caps.has(c));
              const canvas = `/canvas/${site.slug}/${b.name}?thumb=1${theme ? `&theme=${theme}` : ""}`;
              return (
                <Link
                  key={b.name}
                  href={`${base}/${b.name}${theme ? `?theme=${theme}` : ""}`}
                  className="group overflow-hidden bg-card shadow-[0_0_0_1px_var(--color-border)] transition-shadow hover:shadow-[0_0_0_1px_var(--color-foreground),0_8px_24px_-12px_rgb(0_0_0/0.25)] xs:rounded-xl"
                >
                  <BlockFrame src={canvas} title={b.label} height={180} virtualWidth={b.kind === "section" ? 1280 : b.kind === "layout" ? 900 : 480} />
                  <div className="flex items-start gap-2 border-t p-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        {b.label}
                        {missing.length > 0 && <Lock className="size-3 text-muted-foreground" aria-label={`Requires ${missing.join(", ")}`} />}
                      </p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{b.description}</p>
                    </div>
                    {b.presets.length > 0 && <Badge variant="secondary" className="shrink-0">{b.presets.length} presets</Badge>}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </Page>
  );
}
