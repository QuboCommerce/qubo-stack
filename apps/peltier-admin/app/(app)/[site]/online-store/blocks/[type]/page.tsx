import Link from "next/link";
import { notFound } from "next/navigation";
import { Braces, Code2, Eye, Languages, Monitor, Smartphone, Tablet } from "lucide-react";
import { blockCategories, instantiate, isTranslatable, registry, type AnyFieldDef, type FieldMap } from "@peltier/blocks";
import { builtInThemes } from "@peltier/stylekit";
import { BlockFrame } from "@/components/block-frame";
import { Page, Panel } from "@/components/page";
import { ThemeSwitch } from "@/components/theme-switch";
import { Badge } from "@/components/ui/badge";
import { requireSite } from "@/lib/admin";
import { cn } from "@peltier/shared/utils";

type Search = { mode?: string; preset?: string; vw?: string; theme?: string };
const viewports = [
  { id: "390", label: "Mobile", icon: Smartphone },
  { id: "820", label: "Tablet", icon: Tablet },
  { id: "1440", label: "Desktop", icon: Monitor },
];
const groupTone: Record<string, string> = {
  content: "bg-info/15 text-info",
  layout: "bg-warning/15 text-warning",
  style: "bg-brand-hot/15 text-brand-hot",
  advanced: "bg-muted text-muted-foreground",
};

function short(v: unknown): string {
  if (v === "" || v == null) return "—";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 48 ? `${s.slice(0, 46)}…` : s;
}

type Row = { path: string; depth: number; def: AnyFieldDef };
function flatten(fields: FieldMap, prefix = "", depth = 0, out: Row[] = []): Row[] {
  for (const [key, def] of Object.entries(fields)) {
    const path = prefix ? `${prefix}.${key}` : key;
    out.push({ path, depth, def });
    if (def.kind === "group") flatten(def.fields, path, depth + 1, out);
    if (def.kind === "list") flatten(def.item, `${path}[]`, depth + 1, out);
  }
  return out;
}

export async function generateMetadata({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  return { title: registry.get(type)?.label ?? "Block" };
}

export default async function BlockInspectorPage({ params, searchParams }: { params: Promise<{ site: string; type: string }>; searchParams: Promise<Search> }) {
  const [{ site: slug, type }, sp] = await Promise.all([params, searchParams]);
  const { site } = await requireSite(slug);
  const def = registry.get(type);
  if (!def) notFound();

  const mode = sp.mode === "blueprint" ? "blueprint" : "preview";
  const preset = def.presets.find((p) => p.id === sp.preset)?.id;
  const vw = viewports.some((v) => v.id === sp.vw) ? sp.vw! : "1440";
  const theme = sp.theme && sp.theme in builtInThemes ? sp.theme : undefined;
  const base = `/${site.slug}/online-store/blocks/${def.name}`;
  const qs = (patch: Partial<Search>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ mode, preset, vw, theme, ...patch })) if (v) u.set(k, v);
    return `${base}?${u}`;
  };
  const canvas = `/canvas/${site.slug}/${def.name}?${new URLSearchParams(Object.entries({ mode, preset, theme }).filter(([, v]) => v) as [string, string][])}`;
  const rows = flatten(def.fields);
  const translatable = rows.filter((r) => isTranslatable(r.def));
  const node = instantiate(registry, def.name, { preset });
  const caps = new Set<string>(site.capabilities ?? []);
  const seg = "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] font-medium";

  return (
    <Page
      title={def.label}
      subtitle={def.description}
      backHref={`/${site.slug}/online-store/blocks${theme ? `?theme=${theme}` : ""}`}
      width="full"
      className="max-w-[140rem]"
      badge={<Badge variant="outline" className="font-mono text-[11px]">{def.name} · v{def.version}</Badge>}
    >
      <div className="@container grid gap-5 @min-[64rem]:grid-cols-[minmax(0,1fr)_24rem] @min-[90rem]:grid-cols-[minmax(0,1fr)_28rem] @min-[120rem]:grid-cols-[minmax(0,1fr)_32rem]">
        <div className="min-w-0 space-y-3">
          <Panel flush>
            <div className="flex flex-wrap items-center gap-2 border-b p-2">
              <div className="flex rounded-lg bg-muted p-0.5">
                <Link href={qs({ mode: undefined })} className={cn(seg, mode === "preview" ? "bg-card shadow-sm" : "text-muted-foreground")}><Eye className="size-3.5" /> Preview</Link>
                <Link href={qs({ mode: "blueprint" })} className={cn(seg, mode === "blueprint" ? "bg-card shadow-sm" : "text-muted-foreground")}><Braces className="size-3.5" /> Blueprint</Link>
              </div>
              <div className="flex rounded-lg bg-muted p-0.5">
                {viewports.map((v) => (
                  <Link key={v.id} href={qs({ vw: v.id })} title={v.label} className={cn(seg, "px-2", vw === v.id ? "bg-card shadow-sm" : "text-muted-foreground")}>
                    <v.icon className="size-3.5" /><span className="hidden @min-[48rem]:inline">{v.label}</span>
                  </Link>
                ))}
              </div>
              {def.presets.length > 0 && (
                <div className="flex gap-1 overflow-x-auto">
                  <Link href={qs({ preset: undefined })} className={cn(seg, "border", !preset ? "border-foreground" : "text-muted-foreground")}>Default</Link>
                  {def.presets.map((p) => (
                    <Link key={p.id} href={qs({ preset: p.id })} title={p.description} className={cn(seg, "shrink-0 border", preset === p.id ? "border-foreground" : "text-muted-foreground")}>
                      {p.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div className="border-b px-3 py-2"><ThemeSwitch href={(t) => qs({ theme: t })} active={theme} /></div>
            <div className="bg-[repeating-conic-gradient(var(--color-muted)_0_25%,transparent_0_50%)] bg-[length:16px_16px] p-2 sm:p-4">
              <div className="mx-auto overflow-hidden rounded-lg shadow-lg ring-1 ring-black/10" style={{ maxWidth: Number(vw) }}>
                <BlockFrame key={canvas + vw} src={canvas} title={def.label} virtualWidth={Number(vw)} height={def.kind === "section" ? 680 : 420} interactive />
              </div>
            </div>
          </Panel>
          {mode === "blueprint" && (
            <p className="px-3 text-xs text-muted-foreground xs:px-0">
              Blueprint shows the component before data flows in: <code className="rounded bg-muted px-1">{"{{section.heading}}"}</code> marks
              where each field renders. Layout and style values stay as configured.
            </p>
          )}
        </div>

        <div className="space-y-4">
          <Panel title="Overview">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
              <dt className="text-muted-foreground">Kind</dt><dd className="capitalize">{def.kind}</dd>
              <dt className="text-muted-foreground">Category</dt><dd>{blockCategories[def.category]}</dd>
              <dt className="text-muted-foreground">Fields</dt><dd>{rows.length}</dd>
              <dt className="text-muted-foreground">Requires</dt>
              <dd className="flex flex-wrap gap-1">
                {(def.requires ?? []).length === 0 ? "Any site" : def.requires!.map((c) => (
                  <Badge key={c} variant={caps.has(c) ? "secondary" : "outline"} className={cn(!caps.has(c) && "text-muted-foreground line-through")}>{c}</Badge>
                ))}
              </dd>
              {def.keywords?.length ? (<><dt className="text-muted-foreground">Keywords</dt><dd className="text-muted-foreground">{def.keywords.join(", ")}</dd></>) : null}
            </dl>
          </Panel>

          <Panel title="Fields" description="Declared once — the editor panel, validation, AI schema and translations all derive from this." flush>
            <div className="mt-1 max-h-[34rem] overflow-auto border-t">
              <table className="w-full text-[12px]">
                <thead className="sticky top-0 bg-card shadow-[0_1px_0_var(--color-border)]">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Field</th>
                    <th className="px-2 py-2 font-medium">Kind</th>
                    <th className="px-4 py-2 font-medium">Default</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr key={r.path} className="align-top">
                      <td className="px-4 py-1.5" style={{ paddingLeft: 16 + r.depth * 14 }}>
                        <span className="block font-medium">{r.def.meta.label}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">{r.path.split(".").at(-1)}</span>
                      </td>
                      <td className="px-2 py-1.5">
                        <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px]", groupTone[r.def.meta.group ?? "advanced"] ?? groupTone.advanced)}>
                          {r.def.kind}
                          {isTranslatable(r.def) && <Languages className="size-3" aria-label="Translatable" />}
                        </span>
                      </td>
                      <td className="max-w-[12rem] truncate px-4 py-1.5 font-mono text-[11px] text-muted-foreground" title={typeof r.def.default === "string" ? r.def.default : JSON.stringify(r.def.default)}>
                        {r.def.kind === "group" || r.def.kind === "slot" ? "" : short(r.def.default)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Translations" description={`${translatable.length} translatable fields — edited per locale in the inspector (B7).`}>
            <div className="flex flex-wrap gap-1.5">
              {translatable.length === 0 ? <span className="text-[13px] text-muted-foreground">{rows.some((r) => r.def.kind === "slot") ? "Copy lives in the nested blocks inside this section's slots." : "No translatable copy."}</span> : translatable.map((r) => (
                <code key={r.path} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{r.path}</code>
              ))}
            </div>
          </Panel>

          <details className="group overflow-hidden rounded-xl bg-card shadow-[0_0_0_1px_var(--color-border)]">
            <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold">
              <Code2 className="size-4" /> Document JSON
              <span className="ml-auto text-xs font-normal text-muted-foreground">what gets stored</span>
            </summary>
            <pre className="max-h-96 overflow-auto border-t bg-muted/40 p-4 text-[11px] leading-relaxed">{JSON.stringify(node, null, 2)}</pre>
          </details>
        </div>
      </div>
    </Page>
  );
}
