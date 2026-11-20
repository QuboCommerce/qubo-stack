"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { History } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { updateItem } from "@/app/inventory-actions";
import { Field, TextInput } from "@/components/settings/controls";
import { Surface } from "@/components/settings/settings-group";
import { Switch } from "@/components/ui/switch";
import { QuantityEditor } from "./quantity-editor";
import { StockBadge, availableOf, type Stock } from "./stock-status";

export type VariantStock = Stock & { variantId: string; name: string; sku: string | null };

/**
 * Stock card on the product form. It sits inside the product's SettingsForm but saves
 * through inventory actions on its own: its inputs have no `name` and `data-form-ignore`
 * keeps them from marking the product dirty, so they never join its merge.
 */
export function ProductStockCard({ site, productId, productName, variants }: { site: string; productId: string; productName: string; variants: VariantStock[] }) {
  const t = useTranslations("inventory.productCard");
  const inventory = `/${site}/products/inventory`;
  const single = variants.length === 1 ? variants[0] : null;

  return (
    <div data-form-ignore>
      <Surface className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">{t("title")}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{single ? t("separate") : t("variantsHint")}</p>
          </div>
          {single ? (
            <Link
              href={`${inventory}?${new URLSearchParams({ q: single.sku || productName, item: single.variantId })}`}
              className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <History className="size-3.5" /> {t("viewHistory")}
            </Link>
          ) : (
            <Link href={`${inventory}?product=${productId}`} className="shrink-0 text-xs text-muted-foreground hover:text-foreground">
              {t("manage")}
            </Link>
          )}
        </div>
        {single ? (
          <SingleStock site={site} variant={single} />
        ) : (
          <ul className="-mx-4 divide-y border-t text-[13px] sm:-mx-5">
            {variants.map((v) => (
              <li key={v.variantId} className="flex items-center gap-3 px-4 py-2 sm:px-5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{v.name}</span>
                  {v.sku && <span className="block truncate font-mono text-xs text-muted-foreground">{v.sku}</span>}
                </span>
                {v.tracked && <span className="shrink-0 tabular-nums text-muted-foreground">{t("available", { count: availableOf(v) })}</span>}
                <StockBadge stock={v} />
              </li>
            ))}
          </ul>
        )}
      </Surface>
    </div>
  );
}

function SingleStock({ site, variant }: { site: string; variant: VariantStock }) {
  const t = useTranslations("inventory.productCard");
  const tf = useTranslations("inventory.errors");
  const [tracked, setTracked] = useState(variant.tracked);
  const [threshold, setThreshold] = useState(String(variant.threshold));
  const [, start] = useTransition();

  const save = (next: { tracked: boolean; threshold: string }) => {
    const n = Number(next.threshold);
    if (next.threshold.trim() === "" || !Number.isInteger(n) || n < 0) {
      setThreshold(String(variant.threshold));
      toast.error(tf("threshold"));
      return;
    }
    if (next.tracked === variant.tracked && n === variant.threshold) return;
    start(async () => {
      try {
        const res = await updateItem({ site, variantId: variant.variantId, tracked: next.tracked, lowStockThreshold: n });
        if (!res.ok) {
          setTracked(variant.tracked);
          setThreshold(String(variant.threshold));
          toast.error(res.error);
          return;
        }
        toast.success(t("saved"));
      } catch {
        setTracked(variant.tracked);
        setThreshold(String(variant.threshold));
        toast.error(tf("failed"));
      }
    });
  };

  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer items-start justify-between gap-3">
        <span>
          <span className="block text-[13px] font-medium">{t("tracked")}</span>
          <span className="block text-xs text-muted-foreground">{t("trackedHint")}</span>
        </span>
        <Switch
          checked={tracked}
          onCheckedChange={(v) => {
            setTracked(v);
            save({ tracked: v, threshold });
          }}
          className="mt-0.5"
        />
      </label>
      {tracked && (
        <div className="grid items-end gap-4 @min-[36rem]:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-[13px] font-medium">{t("onHand")}</p>
            <div className="flex items-center gap-3">
              <QuantityEditor site={site} variantId={variant.variantId} quantity={variant.quantity} label={t("onHand")} className="-ml-1.5" />
              <StockBadge stock={{ ...variant, tracked }} />
            </div>
            {variant.reserved > 0 && <p className="text-xs text-muted-foreground">{t("available", { count: availableOf(variant) })}</p>}
          </div>
          <Field label={t("threshold")} htmlFor="stock-threshold">
            <TextInput
              id="stock-threshold"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              onBlur={() => save({ tracked, threshold })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  save({ tracked, threshold });
                }
              }}
              className="w-28 tabular-nums"
            />
          </Field>
        </div>
      )}
    </div>
  );
}
