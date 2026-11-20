"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { setQuantity } from "@/app/inventory-actions";
import { cn } from "@qubo/shared/utils";

/**
 * On-hand quantity with -/+ and a free number. Saves on Enter, blur or the check
 * button, optimistically; a failed or raced save rolls back to the server value.
 * Saves run one after another so quick clicks never race each other.
 */
export function QuantityEditor({
  site,
  variantId,
  quantity,
  label,
  onSaved,
  className,
}: {
  site: string;
  variantId: string;
  quantity: number;
  label: string;
  onSaved?: (quantity: number) => void;
  className?: string;
}) {
  const t = useTranslations("inventory");
  const router = useRouter();
  const [base, setBase] = useState(quantity);
  const [value, setValue] = useState(String(quantity));
  const [prop, setProp] = useState(quantity);
  const [pending, setPending] = useState(0);
  const baseRef = useRef(quantity);
  const queue = useRef<Promise<void>>(Promise.resolve());

  // A fresh server value (revalidation, live refresh) wins unless a save is in flight or the user is typing.
  if (quantity !== prop) {
    setProp(quantity);
    if (pending === 0 && Number(value) === base) {
      setBase(quantity);
      setValue(String(quantity));
      baseRef.current = quantity;
    }
  }

  const rollback = (to: number) => {
    baseRef.current = to;
    setBase(to);
    setValue(String(to));
  };

  const commit = (next: number) => {
    if (!Number.isInteger(next) || next < 0) {
      setValue(String(baseRef.current));
      toast.error(t("errors.quantity", { max: 1_000_000 }));
      return;
    }
    const expected = baseRef.current;
    if (next === expected) {
      setValue(String(expected));
      return;
    }
    rollback(next);
    setPending((n) => n + 1);
    queue.current = queue.current.then(async () => {
      try {
        const res = await setQuantity({ site, variantId, expected, next });
        if (res.ok) {
          onSaved?.(res.quantity);
          return;
        }
        // Saves queued after this one were based on it; they fail against the server value too.
        rollback(res.quantity ?? expected);
        toast.error(res.error);
        // Someone else changed it: badges, counts and the sheet were computed from the old value.
        if (res.quantity != null) {
          onSaved?.(res.quantity);
          router.refresh();
        }
      } catch {
        rollback(expected);
        toast.error(t("errors.failed"));
      } finally {
        setPending((n) => n - 1);
      }
    });
  };

  const parsed = value.trim() === "" ? NaN : Number(value);
  const dirty = parsed !== base;
  const btn = "grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40";

  return (
    <div className={cn("inline-flex items-center gap-0.5", className)} data-stop>
      <button type="button" className={btn} aria-label={t("list.decrease")} disabled={base <= 0} onClick={() => commit(baseRef.current - 1)}>
        <Minus className="size-3.5" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        aria-label={label}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => dirty && commit(parsed)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            // Inside the product form, Enter must not submit the product.
            e.preventDefault();
            commit(parsed);
          } else if (e.key === "Escape") {
            setValue(String(base));
          }
        }}
        className="h-7 w-16 rounded-md border bg-card px-2 text-right text-[13px] tabular-nums outline-none transition-shadow [appearance:textfield] focus:ring-2 focus:ring-ring/40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button type="button" className={btn} aria-label={t("list.increase")} onClick={() => commit(baseRef.current + 1)}>
        <Plus className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label={t("list.save")}
        title={t("list.save")}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => commit(parsed)}
        tabIndex={dirty ? 0 : -1}
        className={cn(btn, "text-foreground", !dirty && "invisible")}
      >
        <Check className="size-3.5" />
      </button>
    </div>
  );
}
