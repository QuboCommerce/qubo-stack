"use client";

import {
  CART_STORAGE_KEY,
  MAX_CART_ITEMS,
  MAX_ITEM_QUANTITY,
  type CartItem,
} from "@/lib/cart";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type CartContextValue = {
  items: CartItem[];
  count: number;
  addItem: (item: CartItem) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CartItem>;
  return (
    typeof item.variantId === "string" &&
    typeof item.productSlug === "string" &&
    typeof item.productName === "string" &&
    typeof item.variantName === "string" &&
    typeof item.unitPrice === "string" &&
    Number.isInteger(item.quantity) &&
    Number(item.quantity) > 0 &&
    typeof item.image !== "undefined"
  );
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
      if (Array.isArray(parsed)) {
        setItems(
          parsed
            .filter(isCartItem)
            .slice(0, MAX_CART_ITEMS)
            .map((item) => ({
              ...item,
              quantity: Math.min(item.quantity, MAX_ITEM_QUANTITY),
            })),
        );
      }
    } catch {
      localStorage.removeItem(CART_STORAGE_KEY);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items, loaded]);

  const addItem = useCallback((incoming: CartItem) => {
    setItems((current) => {
      const existing = current.find((item) => item.variantId === incoming.variantId);
      if (existing) {
        return current.map((item) =>
          item.variantId === incoming.variantId
            ? {
                ...item,
                quantity: Math.min(
                  item.quantity + incoming.quantity,
                  MAX_ITEM_QUANTITY,
                ),
              }
            : item,
        );
      }
      if (current.length >= MAX_CART_ITEMS) return current;
      return [...current, { ...incoming, quantity: 1 }];
    });
  }, []);

  const setQuantity = useCallback((variantId: string, quantity: number) => {
    const safeQuantity = Math.min(Math.max(Math.trunc(quantity), 0), MAX_ITEM_QUANTITY);
    setItems((current) =>
      safeQuantity === 0
        ? current.filter((item) => item.variantId !== variantId)
        : current.map((item) =>
            item.variantId === variantId ? { ...item, quantity: safeQuantity } : item,
          ),
    );
  }, []);

  const removeItem = useCallback((variantId: string) => {
    setItems((current) => current.filter((item) => item.variantId !== variantId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({
      items,
      count: items.reduce((sum, item) => sum + item.quantity, 0),
      addItem,
      setQuantity,
      removeItem,
      clear,
    }),
    [addItem, clear, items, removeItem, setQuantity],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const cart = useContext(CartContext);
  if (!cart) throw new Error("useCart must be used inside CartProvider");
  return cart;
}
