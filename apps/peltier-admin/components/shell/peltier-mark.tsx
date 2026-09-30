import { cn } from "@peltier/shared/utils";

/** Peltier mark: a cold and a hot plate joined by a junction. */
export function PeltierMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7", className)}>
      <defs>
        <linearGradient id="pk-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--brand-cold)" />
          <stop offset="1" stopColor="var(--brand-hot)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#pk-mark)" />
      <path d="M9 11.5h14M9 20.5h14" stroke="white" strokeWidth="2.4" strokeLinecap="round" opacity="0.95" />
      <path d="M13 11.5v9M19 11.5v9" stroke="white" strokeWidth="2.4" strokeLinecap="round" opacity="0.55" />
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
