import { cn } from "@qubo/shared/utils";

/** Language code as a small tile: `nl-BE` reads NL with BE underneath. */
export function LocaleMark({ locale, primary }: { locale: string; primary?: boolean }) {
  const [lang = "", region] = locale.split("-");
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 flex-col items-center justify-center rounded-lg font-mono leading-none",
        primary ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
      )}
    >
      <span className="text-[11px] font-semibold">{lang.toUpperCase()}</span>
      {region && <span className="mt-0.5 text-[8.5px] opacity-70">{region}</span>}
    </span>
  );
}
