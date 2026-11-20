import { useTranslations } from "next-intl";
import { control } from "@/components/settings/controls";
import { weekdays, type DayHours, type Weekday } from "@/lib/opening-hours";
import { cn } from "@qubo/shared/utils";

/**
 * Seven weekday rows: an on/off checkbox plus opens/closes times. The time
 * inputs are only disabled visually (CSS) so a closed day still posts its
 * times, which keeps the three-way merge simple.
 */
export function OpeningHoursRows({ hours, disabled }: { hours: Record<Weekday, DayHours>; disabled?: boolean }) {
  const t = useTranslations("settings.hours");
  const tDays = useTranslations("settings.weekdays");
  return (
    <>
      {weekdays.map((d) => {
        const day = hours[d];
        return (
          <div key={d} className="group flex items-center gap-3 px-4 py-2.5 sm:px-5">
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 has-[:disabled]:cursor-default">
              <input type="checkbox" name={`hours_${d}_open`} value="on" defaultChecked={day.open} disabled={disabled} className="peer sr-only" />
              <span
                aria-hidden
                className="relative h-5 w-9 shrink-0 rounded-full bg-foreground/15 transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-foreground peer-checked:after:translate-x-4 peer-focus-visible:ring-3 peer-focus-visible:ring-ring/40 peer-disabled:opacity-60"
              />
              <span className="w-24 text-sm font-medium">{tDays(d)}</span>
              <span className="text-[13px] text-muted-foreground peer-checked:hidden">{t("closed")}</span>
            </label>
            <div className="flex items-center gap-2 group-has-[input[type=checkbox]:not(:checked)]:pointer-events-none group-has-[input[type=checkbox]:not(:checked)]:opacity-0">
              <input type="time" name={`hours_${d}_opens`} defaultValue={day.opens} disabled={disabled} aria-label={t("opens", { day: tDays(d) })} className={cn(control, "h-8 w-28 px-2 text-[13px]")} />
              <span className="text-xs text-muted-foreground">{t("to")}</span>
              <input type="time" name={`hours_${d}_closes`} defaultValue={day.closes} disabled={disabled} aria-label={t("closes", { day: tDays(d) })} className={cn(control, "h-8 w-28 px-2 text-[13px]")} />
            </div>
          </div>
        );
      })}
    </>
  );
}
