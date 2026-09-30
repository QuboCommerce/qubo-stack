import { cn } from "@peltier/shared/utils";

/**
 * One topic on a settings page. Narrow: heading above its card.
 * Wide: annotated layout — heading on the left, card on the right.
 */
export function SettingsGroup({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("grid gap-2.5 @min-[72rem]:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] @min-[72rem]:gap-10 @min-[96rem]:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]", className)}>
      <div className="px-3 xs:px-0 @min-[72rem]:pt-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** Plain white surface matching Panel, without a header. */
export function Surface({ children, className, flush }: { children: React.ReactNode; className?: string; flush?: boolean }) {
  return (
    <div
      className={cn(
        "overflow-hidden bg-card text-card-foreground xs:rounded-xl",
        "shadow-[0_1px_0_0_rgb(0_0_0/0.06),0_0_0_1px_rgb(0_0_0/0.06),inset_0_-1px_0_0_rgb(0_0_0/0.06)] dark:shadow-[0_0_0_1px_rgb(255_255_255/0.07)]",
        !flush && "p-4 sm:p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
