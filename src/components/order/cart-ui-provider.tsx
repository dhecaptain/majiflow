"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CartLine } from "@/lib/cart";
import { businesses } from "@/lib/data/businesses";
import { useCart } from "@/components/order/cart-provider";

interface PendingSwitch {
  line: CartLine;
  /** Name of the station the incoming item belongs to. */
  businessName: string;
  /** Name of the station the cart currently holds items from. */
  currentBusinessName: string;
}

interface CartUiContextValue {
  open: boolean;
  openCart: () => void;
  closeCart: () => void;
  setOpen: (next: boolean) => void;
  /**
   * Add a line, asking first when the cart already holds items from a different
   * station. One order is one station, so the customer picks between keeping
   * the current order and starting a new one.
   */
  requestAdd: (line: CartLine) => void;
  pendingSwitch: PendingSwitch | null;
  /** Replace the current order with the incoming item's station. */
  confirmSwitch: () => void;
  cancelSwitch: () => void;
}

const CartUiContext = createContext<CartUiContextValue | null>(null);

const businessName = (id: string) => businesses.find((b) => b.id === id)?.name ?? "this station";

export function CartUiProvider({ children }: { children: ReactNode }) {
  const { items, addItem } = useCart();
  const [open, setOpen] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<PendingSwitch | null>(null);

  const openCart = useCallback(() => setOpen(true), []);
  const closeCart = useCallback(() => setOpen(false), []);

  const requestAdd = useCallback(
    (line: CartLine) => {
      const otherStation = items.find((i) => i.businessId !== line.businessId);
      if (otherStation) {
        setPendingSwitch({
          line,
          businessName: businessName(line.businessId),
          currentBusinessName: businessName(otherStation.businessId),
        });
        return;
      }
      addItem(line);
    },
    [items, addItem]
  );

  const confirmSwitch = useCallback(() => {
    if (!pendingSwitch) return;
    // Starting a new order replaces the old cart: one order, one station.
    addItem(pendingSwitch.line);
    setPendingSwitch(null);
  }, [pendingSwitch, addItem]);

  const cancelSwitch = useCallback(() => setPendingSwitch(null), []);

  const value = useMemo(
    () => ({ open, openCart, closeCart, setOpen, requestAdd, pendingSwitch, confirmSwitch, cancelSwitch }),
    [open, openCart, closeCart, requestAdd, pendingSwitch, confirmSwitch, cancelSwitch]
  );

  return <CartUiContext.Provider value={value}>{children}</CartUiContext.Provider>;
}

export function useCartUi(): CartUiContextValue {
  const ctx = useContext(CartUiContext);
  if (!ctx) throw new Error("useCartUi must be used within CartUiProvider");
  return ctx;
}

/** Variant for components that may render outside the provider (falls back to a direct add). */
export function useOptionalCartUi(): CartUiContextValue | null {
  return useContext(CartUiContext);
}
