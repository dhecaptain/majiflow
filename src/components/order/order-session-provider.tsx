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
import type { DeliveryAddress, FulfillmentMethod } from "@/lib/types";
import { PICKUP_ENABLED } from "@/config/fulfilment";
import { useCustomer } from "@/components/order/customer-provider";

/**
 * The browsing/ordering context the customer should never lose: how they want
 * the order (delivery or pickup) and which address it goes to. Kept separate
 * from CustomerProfile because it is *this session's* choice, not saved profile
 * data - it survives navigation and reloads via localStorage.
 */
export interface OrderSession {
  fulfilment: FulfillmentMethod;
  address: DeliveryAddress | null;
  /** True once the persisted session has been read, so UIs don't flash empty. */
  hydrated: boolean;
}

interface OrderSessionContextValue extends OrderSession {
  setFulfilment: (method: FulfillmentMethod) => void;
  setAddress: (address: DeliveryAddress | null) => void;
  /** One-tap: use the signed-in customer's saved default address. */
  useDefaultAddress: () => void;
}

const OrderSessionContext = createContext<OrderSessionContextValue | null>(null);

const STORAGE_KEY = "mf:orderSession";

interface StoredSession {
  fulfilment?: FulfillmentMethod;
  address?: DeliveryAddress | null;
}

function oneLine(a: DeliveryAddress | null | undefined): string {
  if (!a) return "";
  return [a.street, a.estate, a.city].filter(Boolean).join(", ") || a.label || "";
}

export function orderSessionLabel(session: Pick<OrderSession, "fulfilment" | "address">): string {
  if (session.fulfilment === "pickup") return "Pickup from station";
  return oneLine(session.address) || "Set your delivery address";
}

export function OrderSessionProvider({ children }: { children: ReactNode }) {
  const { profile, hydrated: profileHydrated } = useCustomer();
  const [fulfilment, setFulfilmentState] = useState<FulfillmentMethod>("delivery");
  const [address, setAddressState] = useState<DeliveryAddress | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate the order session from localStorage after mount */
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredSession;
        // A saved pickup choice is ignored while pickup is off, so nobody is
        // left in a mode the order pipeline cannot complete.
        if (parsed.fulfilment === "delivery" || (PICKUP_ENABLED && parsed.fulfilment === "pickup")) {
          setFulfilmentState(parsed.fulfilment);
        }
        if (parsed.address && typeof parsed.address === "object") {
          setAddressState(parsed.address);
        }
      }
    } catch {
      /* noop */
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Seed from the saved profile address once, if this session has none yet.
  useEffect(() => {
    if (!hydrated || !profileHydrated) return;
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- one-time seed from the saved profile */
    setAddressState((current) => current ?? profile.addresses[profile.defaultAddressIndex] ?? profile.addresses[0] ?? null);
  }, [hydrated, profileHydrated, profile.addresses, profile.defaultAddressIndex]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ fulfilment, address } satisfies StoredSession));
    } catch {
      /* noop */
    }
  }, [fulfilment, address, hydrated]);

  const setFulfilment = useCallback(
    (method: FulfillmentMethod) => setFulfilmentState(PICKUP_ENABLED ? method : "delivery"),
    []
  );
  const setAddress = useCallback((next: DeliveryAddress | null) => setAddressState(next), []);
  const useDefaultAddress = useCallback(() => {
    const saved = profile.addresses[profile.defaultAddressIndex] ?? profile.addresses[0] ?? null;
    if (saved) setAddressState(saved);
  }, [profile.addresses, profile.defaultAddressIndex]);

  const value = useMemo<OrderSessionContextValue>(
    () => ({ fulfilment, address, hydrated, setFulfilment, setAddress, useDefaultAddress }),
    [fulfilment, address, hydrated, setFulfilment, setAddress, useDefaultAddress]
  );

  return <OrderSessionContext.Provider value={value}>{children}</OrderSessionContext.Provider>;
}

export function useOrderSession(): OrderSessionContextValue {
  const ctx = useContext(OrderSessionContext);
  if (!ctx) throw new Error("useOrderSession must be used within OrderSessionProvider");
  return ctx;
}
