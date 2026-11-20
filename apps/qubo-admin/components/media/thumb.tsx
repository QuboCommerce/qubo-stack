import { FileJson, FileSpreadsheet, FileText, Film } from "lucide-react";
import type { MediaItem } from "@qubo/storage/media";
import { cn } from "@qubo/shared/utils";

export function fileIcon(item: Pick<MediaItem, "kind" | "mimeType">) {
  if (item.kind === "video") return Film;
  if (item.mimeType.startsWith("application/json")) return FileJson;
  if (item.mimeType.startsWith("text/csv")) return FileSpreadsheet;
  return FileText;
}

export function Thumb({ item, className }: { item: Pick<MediaItem, "kind" | "url" | "alt" | "filename"> & { mimeType?: string }; className?: string }) {
  if (item.kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.url} alt={item.alt || item.filename} loading="lazy" className={cn("size-full object-cover", className)} />;
  }
  const Icon = fileIcon({ kind: item.kind, mimeType: item.mimeType ?? "" });
  return (
    <span className={cn("flex size-full flex-col items-center justify-center gap-1 p-2 text-muted-foreground", className)}>
      <Icon className="size-6" />
      <span className="line-clamp-2 text-center text-[11px] break-all">{item.filename}</span>
    </span>
  );
}

export function Segments<T extends string | undefined>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; title?: string }[];
  label?: string;
}) {
  return (
    <div className="flex rounded-md border p-0.5" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn("rounded px-2 py-1 text-xs whitespace-nowrap", value === o.value ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
