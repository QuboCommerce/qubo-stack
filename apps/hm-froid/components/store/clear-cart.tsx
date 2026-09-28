"use client";

import { useCart } from "@/components/store/cart-provider";
import { useEffect } from "react";

export function ClearCart() {
  const { clear } = useCart();
  useEffect(() => clear(), [clear]);
  return null;
}
