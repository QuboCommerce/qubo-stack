import { cn } from "@qubo/shared/utils";

/** Qubo mark: an isometric cube, three faces at three weights. */
export function QuboMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7", className)}>
      <defs>
        <linearGradient id="qubo-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--brand-cold)" />
          <stop offset="1" stopColor="var(--brand-hot)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#qubo-mark)" />
      <g fill="white" strokeLinejoin="round">
        <path d="M16 8l7 4-7 4-7-4z" opacity="0.95" />
        <path d="M9 12l7 4v8l-7-4z" opacity="0.7" />
        <path d="M23 12l-7 4v8l7-4z" opacity="0.45" />
      </g>
    </svg>
  );
}

export function SiteAvatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  let hue = 0;
  for (const c of name) hue = (hue * 31 + c.charCodeAt(0)) % 360;
  return (
    <span
      className={cn("inline-grid size-7 shrink-0 place-items-center rounded-lg text-[11px] font-semibold text-white", className)}
      style={{ background: `linear-gradient(135deg, oklch(0.62 0.14 ${hue}), oklch(0.5 0.14 ${(hue + 40) % 360}))` }}
    >
      {initials}
    </span>
  );
}
