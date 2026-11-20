"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { th, td } from "@/components/index-table";
import { ProductThumb } from "@/components/products/product-thumb";
import { formatters } from "@/lib/format";
import { cn } from "@qubo/shared/utils";
import { ItemSheet, type SheetTarget } from "./item-sheet";
import { QuantityEditor } from "./quantity-editor";
import { StockBadge, availableOf } from "./stock-status";

export type InventoryTableRow = {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  sku: string | null;
  variantCount: number;
  image: string | null;
  quantity: number;
  reserved: number;
  threshold: number;
  tracked: boolean;
};

/** Index rows with inline on-hand editing; clicking a row (outside its controls) opens the item sheet. */
export function InventoryTable({ site, rows, initialItem }: { site: string; rows: InventoryTableRow[]; initialItem?: string }) {
  const t = useTranslations("inventory.list");
  const f = formatters(useLocale());
  const productHref = (id: string) => `/${site}/products/${id}`;
  const toTarget = (r: InventoryTableRow): SheetTarget => ({
    variantId: r.variantId,
    productName: r.productName,
    variantName: r.variantCount > 1 ? r.variantName : null,
    sku: r.sku,
  });
  const [target, setTarget] = useState<SheetTarget | null>(() => {
    const r = initialItem ? rows.find((x) => x.variantId === initialItem) : undefined;
    return r ? toTarget(r) : null;
  });

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className={cn(th, "w-full")}>{t("columns.product")}</th>
              <th className={cn(th, "hidden @min-[48rem]:table-cell")}>{t("columns.sku")}</th>
              <th className={cn(th, "hidden @min-[36rem]:table-cell")}>{t("columns.status")}</th>
              <th className={cn(th, "hidden text-right @min-[40rem]:table-cell")}>{t("columns.available")}</th>
              <th className={cn(th, "text-right")}>{t("columns.onHand")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => {
              const multi = r.variantCount > 1;
              const label = multi ? `${r.productName} (${r.variantName})` : r.productName;
              return (
                <tr
                  key={r.variantId}
                  tabIndex={0}
                  aria-selected={target?.variantId === r.variantId}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("a,button,input,select,[data-stop]")) return;
                    setTarget(toTarget(r));
                  }}
                  onKeyDown={(e) => {
                    if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      setTarget(toTarget(r));
                    }
                  }}
                  className="cursor-pointer transition-colors outline-none hover:bg-accent/40 focus-visible:bg-accent/40 aria-selected:bg-accent/50"
                >
                  <td className={cn(td, "w-full max-w-0 py-2")}>
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg border bg-white">
                        <ProductThumb src={r.image} />
                      </div>
                      <div className="min-w-0">
                        <Link href={productHref(r.productId)} className="line-clamp-1 font-medium hover:underline">{r.productName}</Link>
                        {multi && <p className="truncate text-xs text-muted-foreground">{r.variantName}</p>}
                        <p className="truncate font-mono text-xs text-muted-foreground @min-[48rem]:hidden">{r.sku}</p>
                      </div>
                    </div>
                  </td>
                  <td className={cn(td, "hidden whitespace-nowrap font-mono text-xs text-muted-foreground @min-[48rem]:table-cell")}>{r.sku ?? ""}</td>
                  <td className={cn(td, "hidden @min-[36rem]:table-cell")}>
                    <StockBadge stock={r} />
                  </td>
                  <td className={cn(td, "hidden whitespace-nowrap text-right tabular-nums @min-[40rem]:table-cell")}>
                    {r.tracked ? f.number(availableOf(r)) : <span className="text-muted-foreground">∞</span>}
                  </td>
                  <td className={cn(td, "whitespace-nowrap py-1.5 text-right")}>
                    {r.tracked ? (
                      <QuantityEditor site={site} variantId={r.variantId} quantity={r.quantity} label={t("quantityLabel", { name: label })} className="-mr-1" />
                    ) : (
                      <span className="pr-8 text-xs text-muted-foreground">{t("notTracked")}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ItemSheet site={site} target={target} productHref={productHref} onClose={() => setTarget(null)} />
    </>
  );
}
