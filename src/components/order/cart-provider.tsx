"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { cartLineKey, clampQuantity, sanitizeCartLines, type CartLine } from "@/lib/cart";

export type { CartLine };

interface CartContextValue {
  items: CartLine[];
  count: number;
  /** False until the saved cart has been read, so pages don't flash an empty state. */
  hydrated: boolean;
  /**
   * Add a line. The cart holds one station at a time: adding from a different
   * station starts a new order and replaces what was there.
   */
  addItem: (line: CartLine) => void;
  updateQuantity: (line: CartLine, quantity: number) => void;
  removeItem: (line: CartLine) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "mf:cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate the cart from localStorage after mount */
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(sanitizeCartLines(JSON.parse(raw)));
    } catch {
      /* noop */
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* noop */
    }
  }, [items, hydrated]);

  const addItem = useCallback((line: CartLine) => {
    setItems((prev) => {
      const quantity = clampQuantity(line.quantity);
      if (quantity <= 0) return prev;
      // One station per order: an item from another station starts a new
      // order, so the cart never mixes two stations' items.
      const sameStation = prev.every((i) => i.businessId === line.businessId);
      const base = sameStation ? prev : [];
      const key = cartLineKey(line);
      const existing = base.find((i) => cartLineKey(i) === key);
      if (existing) {
        return base.map((i) =>
          i === existing ? { ...i, quantity: clampQuantity(i.quantity + quantity) } : i
        );
      }
      return [...base, { ...line, quantity }];
    });
  }, []);

  const updateQuantity = useCallback((line: CartLine, next: number) => {
    const quantity = clampQuantity(next);
    const key = cartLineKey(line);
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => cartLineKey(i) !== key)
        : prev.map((i) => (cartLineKey(i) === key ? { ...i, quantity } : i))
    );
  }, []);

  const removeItem = useCallback((line: CartLine) => {
    const key = cartLineKey(line);
    setItems((prev) => prev.filter((i) => cartLineKey(i) !== key));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const count = useMemo(() => items.reduce((n, i) => n + i.quantity, 0), [items]);

  return (
    <CartContext.Provider
      value={{ items, count, hydrated, addItem, updateQuantity, removeItem, clear }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}