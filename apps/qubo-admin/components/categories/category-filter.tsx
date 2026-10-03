"use client";

import { useRouter } from "next/navigation";
import { FolderTree } from "lucide-react";

/** Category dropdown for index pages; `hrefBase` is the current URL without `category`. */
export function CategoryFilter({ options, value, hrefBase }: { options: { id: string; name: string; depth: number }[]; value: string; hrefBase: string }) {
  const router = useRouter();
  return (
    <label className="relative flex min-w-0 shrink items-center">
      <FolderTree className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground" />
      <span className="sr-only">Category</span>
      <select
        value={value}
        onChange={(e) => router.push(e.target.value ? `${hrefBase}${hrefBase.includes("?") ? "&" : "?"}category=${e.target.value}` : hrefBase)}
        className="h-8 w-full max-w-56 truncate rounded-lg border bg-background pl-8 pr-2 text-[13px] outline-none focus:ring-2 focus:ring-ring/40"
      >
        <option value="">All categories</option>
        <option value="none">Uncategorised</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{"\u00a0\u00a0\u00a0".repeat(o.depth)}{o.name}</option>
        ))}
      </select>
    </label>
  );
}
