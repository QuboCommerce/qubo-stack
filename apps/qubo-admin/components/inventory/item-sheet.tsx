"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { adjustStock, loadItem, updateItem, type AdjustReason } from "@/app/inventory-actions";
import { Field, Select, TextInput } from "@/components/settings/controls";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { formatters } from "@/lib/format";
import type { InventoryDetail } from "@/lib/inventory";
import { cn } from "@qubo/shared/utils";
import { QuantityEditor } from "./quantity-editor";
import { StockBadge, availableOf } from "./stock-status";

const reasonsFor: Record<"add" | "remove", AdjustReason[]> = {
  add: ["RESTOCK", "RETURN", "ADJUSTMENT"],
  remove: ["DAMAGED", "ADJUSTMENT"],
};

export type SheetTarget = { variantId: string; productName: string; variantName: string | null; sku: string | null };

/** Stock settings, a reasoned change and the latest history for one variant. */
export function ItemSheet({ site, target, productHref, onClose }: { site: string; target: SheetTarget | null; productHref: (productId: string) => string; onClose: () => void }) {
  const t = useTranslations("inventory");
  return (
    <Sheet open={target != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        {target && (
          <>
            <SheetHeader className="border-b pr-10">
              <SheetTitle className="line-clamp-2 text-base">{target.productName}</SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-x-2 text-[13px]">
                {target.variantName && <span>{target.variantName}</span>}
                {target.sku ? <span className="font-mono text-xs">{target.sku}</span> : <span>{t("sheet.description")}</span>}
              </SheetDescription>
            </SheetHeader>
            <SheetBody key={target.variantId} site={site} variantId={target.variantId} productHref={productHref} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SheetBody({ site, variantId, productHref }: { site: string; variantId: string; productHref: (productId: string) => string }) {
  const t = useTranslations("inventory");
  const [item, setItem] = useState<InventoryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await loadItem({ site, variantId });
      if (res.ok) setItem(res.item);
      else setError(res.error);
    } catch {
      setError(t("errors.failed"));
    }
  }, [site, variantId, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (error) return <p className="p-4 text-sm text-destructive">{error}</p>;
  if (!item) {
    return (
      <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> {t("sheet.loading")}
      </p>
    );
  }
  return (
    <div className="divide-y">
      <Counts site={site} item={item} onChange={reload} productHref={productHref} />
      <Settings site={site} item={item} onSaved={reload} />
      {item.tracked && <RecordChange site={site} variantId={variantId} onRecorded={reload} />}
      <History item={item} />
    </div>
  );
}

function Counts({ site, item, onChange, productHref }: { site: string; item: InventoryDetail; onChange: () => void; productHref: (productId: string) => string }) {
  const t = useTranslations("inventory.sheet");
  const f = formatters(useLocale());
  const stock = { tracked: item.tracked, quantity: item.quantity, reserved: item.reserved, threshold: item.threshold };
  return (
    <section className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <StockBadge stock={stock} />
        <Link href={productHref(item.productId)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          {t("openProduct")} <ExternalLink className="size-3" />
        </Link>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-[13px]">
        <div className="rounded-lg border p-2.5">
          <dt className="text-xs text-muted-foreground">{t("onHand")}</dt>
          <dd className="mt-1">
            <QuantityEditor site={site} variantId={item.variantId} quantity={item.quantity} label={t("onHand")} onSaved={onChange} className="-ml-1.5" />
          </dd>
        </div>
        <div className="rounded-lg border p-2.5" title={t("reservedHint")}>
          <dt className="text-xs text-muted-foreground">{t("reserved")}</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums leading-7">{f.number(item.reserved)}</dd>
        </div>
        <div className="rounded-lg border p-2.5">
          <dt className="text-xs text-muted-foreground">{t("available")}</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums leading-7">{item.tracked ? f.number(availableOf(item)) : "∞"}</dd>
        </div>
      </dl>
    </section>
  );
}

function Settings({ site, item, onSaved }: { site: string; item: InventoryDetail; onSaved: () => void }) {
  const t = useTranslations("inventory.sheet");
  const tf = useTranslations("inventory.errors");
  const [tracked, setTracked] = useState(item.tracked);
  const [threshold, setThreshold] = useState(String(item.threshold));
  const [supplier, setSupplier] = useState(item.supplier);
  const [location, setLocation] = useState(item.storageLocation);
  const [pending, start] = useTransition();
  const dirty = tracked !== item.tracked || threshold !== String(item.threshold) || supplier !== item.supplier || location !== item.storageLocation;

  const save = () =>
    start(async () => {
      const n = Number(threshold);
      if (threshold.trim() === "" || !Number.isInteger(n) || n < 0) {
        toast.error(tf("threshold"));
        return;
      }
      try {
        const res = await updateItem({ site, variantId: item.variantId, tracked, lowStockThreshold: n, supplier, storageLocation: location });
        if (!res.ok) return void toast.error(res.error);
        toast.success(t("saved"));
        onSaved();
      } catch {
        toast.error(tf("failed"));
      }
    });

  return (
    <form
      className="space-y-4 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label className="flex cursor-pointer items-start justify-between gap-3">
        <span>
          <span className="block text-[13px] font-medium">{t("tracked")}</span>
          <span className="block text-xs text-muted-foreground">{t("trackedHint")}</span>
        </span>
        <Switch checked={tracked} onCheckedChange={setTracked} className="mt-0.5" />
      </label>
      <Field label={t("threshold")} htmlFor="inv-threshold" hint={t("thresholdHint")}>
        <TextInput id="inv-threshold" type="number" min={0} step={1} inputMode="numeric" value={threshold} onChange={(e) => setThreshold(e.target.value)} className="w-28 tabular-nums" disabled={!tracked} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("supplier")} htmlFor="inv-supplier">
          <TextInput id="inv-supplier" value={supplier} maxLength={200} onChange={(e) => setSupplier(e.target.value)} />
        </Field>
        <Field label={t("storageLocation")} htmlFor="inv-location">
          <TextInput id="inv-location" value={location} maxLength={200} placeholder={t("storagePlaceholder")} onChange={(e) => setLocation(e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!dirty || pending}>
          {pending && <Loader2 className="animate-spin" />} {t("save")}
        </Button>
      </div>
    </form>
  );
}

function RecordChange({ site, variantId, onRecorded }: { site: string; variantId: string; onRecorded: () => void }) {
  const t = useTranslations("inventory.sheet.record");
  const tr = useTranslations("inventory.reasons");
  const tf = useTranslations("inventory.errors");
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [amount, setAmount] = useState("1");
  const [reason, setReason] = useState<AdjustReason>("RESTOCK");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  const pick = (d: "add" | "remove") => {
    setDirection(d);
    setReason(reasonsFor[d][0]);
  };

  const submit = () =>
    start(async () => {
      const n = Number(amount);
      if (!Number.isInteger(n) || n <= 0) {
        toast.error(tf("amount"));
        return;
      }
      try {
        const res = await adjustStock({ site, variantId, delta: direction === "add" ? n : -n, reason, note: note.trim() || undefined });
        if (!res.ok) {
          toast.error(res.error);
          if (res.quantity != null) onRecorded();
          return;
        }
        toast.success(t("recorded"));
        setAmount("1");
        setNote("");
        onRecorded();
      } catch {
        toast.error(tf("failed"));
      }
    });

  return (
    <form
      className="space-y-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <h3 className="text-sm font-semibold">{t("title")}</h3>
      <div className="flex items-end gap-2">
        <div className="flex shrink-0 rounded-lg border p-0.5" role="radiogroup">
          {(["add", "remove"] as const).map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={direction === d}
              onClick={() => pick(d)}
              className={cn("h-7 rounded-md px-2.5 text-[13px] font-medium transition-colors", direction === d ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {t(d)}
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="inv-amount">{t("amount")}</label>
        <TextInput id="inv-amount" type="number" min={1} step={1} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-8 w-20 text-right tabular-nums" />
        <label className="sr-only" htmlFor="inv-reason">{t("reason")}</label>
        <Select id="inv-reason" value={reason} onChange={(e) => setReason(e.target.value as AdjustReason)} className="h-8 min-w-0 flex-1 text-[13px]">
          {reasonsFor[direction].map((r) => (
            <option key={r} value={r}>{tr(r)}</option>
          ))}
        </Select>
      </div>
      <Field label={t("note")} htmlFor="inv-note">
        <TextInput id="inv-note" value={note} maxLength={500} placeholder={t("notePlaceholder")} onChange={(e) => setNote(e.target.value)} className="h-8 text-[13px]" />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} {t("submit")}
        </Button>
      </div>
    </form>
  );
}

function History({ item }: { item: InventoryDetail }) {
  const t = useTranslations("inventory.sheet.history");
  const tr = useTranslations("inventory.reasons");
  const locale = useLocale();
  const f = formatters(locale);
  return (
    <section className="p-4">
      <h3 className="mb-2 text-sm font-semibold">{t("title")}</h3>
      {item.history.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">{t("empty")}</p>
      ) : (
        <ol className="divide-y text-[13px]">
          {item.history.map((h) => {
            const label = h.referenceType === "damaged" ? tr("DAMAGED") : tr(h.reason);
            const note = h.referenceType === "note" || h.referenceType === "damaged" ? h.referenceId : null;
            return (
              <li key={h.id} className="flex items-start gap-3 py-2">
                <span className={cn("w-12 shrink-0 text-right font-medium tabular-nums", h.adjustment > 0 ? "text-success" : "text-destructive")}>
                  {h.adjustment > 0 ? "+" : "−"}{f.number(Math.abs(h.adjustment))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{label}</span>
                  {note && <span className="block break-words text-xs text-muted-foreground">{note}</span>}
                  {h.referenceType === "order" && <span className="block text-xs text-muted-foreground">{t("order")}</span>}
                </span>
                <span className="shrink-0 text-right text-xs text-muted-foreground">
                  <time dateTime={h.createdAt} title={new Date(h.createdAt).toLocaleString(locale)} className="block">
                    {f.relativeTime(h.createdAt)}
                  </time>
                  <span className="block">{h.by ?? t("system")}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
