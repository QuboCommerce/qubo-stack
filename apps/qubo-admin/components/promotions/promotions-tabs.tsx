import Link from "next/link";
import { cn } from "@qubo/shared/utils";

export function PromotionsTabs({ site, active }: { site: string; active: "sales" | "codes" }) {
  const tabs = [
    { id: "sales", label: "Sale prices", href: `/${site}/promotions` },
    { id: "codes", label: "Discount codes", href: `/${site}/promotions/codes` },
  ] as const;
  return (
    <nav className="flex gap-1 border-b">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          aria-current={active === t.id ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            active === t.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
