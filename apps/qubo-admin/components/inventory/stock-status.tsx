"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@qubo/shared/utils";

export type Stock = { tracked: boolean; quantity: number; reserved: number; threshold: number };
export type StockState = "inStock" | "low" | "out" | "untracked";

export const availableOf = (s: Pick<Stock, "quantity" | "reserved">) => Math.max(s.quantity - s.reserved, 0);

/** Same rules as the tabs in lib/inventory.ts. */
export function stockState(s: Stock): StockState {
  if (!s.tracked) return "untracked";
  const available = availableOf(s);
  if (available === 0) return "out";
  return available <= s.threshold ? "low" : "inStock";
}

const tone: Record<StockState, string> = {
  inStock: "bg-success/15 text-success",
  low: "bg-warning/15 text-warning",
  out: "bg-destructive/10 text-destructive",
  untracked: "bg-secondary text-muted-foreground",
};

export function StockBadge({ stock, className }: { stock: Stock; className?: string }) {
  const t = useTranslations("inventory.status");
  const state = stockState(stock);
  return <Badge className={cn("border-transparent", tone[state], className)}>{t(state)}</Badge>;
}
