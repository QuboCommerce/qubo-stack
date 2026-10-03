import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { cn } from "@qubo/shared/utils";

/**
 * Page widths grow with the screen, like Shopify's admin:
 *  narrow  – forms & settings
 *  default – detail pages, dashboards
 *  wide    – index tables, galleries
 *  full    – editors and data-dense views
 */
const widths = {
  narrow: "max-w-3xl 3xl:max-w-4xl 4xl:max-w-5xl",
  default: "max-w-5xl xl:max-w-6xl 2xl:max-w-7xl 3xl:max-w-8xl 4xl:max-w-9xl",
  wide: "max-w-7xl 2xl:max-w-8xl 3xl:max-w-9xl 4xl:max-w-10xl",
  full: "max-w-none",
} as const;

export type PageWidth = keyof typeof widths;

export function Page({
  title,
  subtitle,
  backHref,
  actions,
  badge,
  width = "default",
  children,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  backHref?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  width?: PageWidth;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full px-0 pb-16 pt-4 xs:px-3 sm:px-5 sm:pt-6 lg:px-8 lg:pt-8 3xl:px-10 4xl:px-14", widths[width], className)}>
      <header className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 px-3 xs:px-0 sm:mb-6">
        {backHref && (
          <Link href={backHref} className="grid size-8 place-items-center rounded-lg hover:bg-accent" aria-label="Back">
            <ArrowLeft className="size-4" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-[1.375rem]">{title}</h1>
            {badge}
          </div>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex w-full items-center gap-2 xs:w-auto">{actions}</div>}
      </header>
      <div className="space-y-4 sm:space-y-5">{children}</div>
    </div>
  );
}

/** Shopify-style card: white, soft bevel shadow, square on phones. */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  flush,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** No body padding (tables, lists). */
  flush?: boolean;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden bg-card text-card-foreground xs:rounded-xl",
        "shadow-[0_1px_0_0_rgb(0_0_0/0.06),0_0_0_1px_rgb(0_0_0/0.06),inset_0_-1px_0_0_rgb(0_0_0/0.06)] dark:shadow-[0_0_0_1px_rgb(255_255_255/0.07)]",
        className,
      )}
    >
      {(title || action) && (
        <header className="flex items-start gap-3 px-4 pt-4 sm:px-5">
          <div className="min-w-0 flex-1">
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn(!flush && "p-4 sm:p-5", !flush && (title || action) && "pt-3 sm:pt-3", flush && (title || action) && "mt-3", bodyClassName)}>
        {children}
      </div>
    </section>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center sm:py-16", className)}>
      <div className="relative mb-5">
        <div className="absolute inset-0 -z-10 scale-150 rounded-full bg-gradient-to-br from-brand-cold/25 to-brand-hot/25 blur-2xl" />
        <div className="grid size-14 place-items-center rounded-2xl border bg-card shadow-sm">
          <Icon className="size-6 text-muted-foreground" />
        </div>
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function StatusDot({ tone }: { tone: "success" | "warning" | "info" | "muted" | "destructive" }) {
  const color = {
    success: "bg-success",
    warning: "bg-warning",
    info: "bg-info",
    muted: "bg-muted-foreground/50",
    destructive: "bg-destructive",
  }[tone];
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", color)} />;
}
