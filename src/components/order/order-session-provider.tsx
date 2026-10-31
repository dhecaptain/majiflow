"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { DeliveryAddress, FulfillmentMethod } from "@/lib/types";
import { orderSessionLabel } from "@/lib/order-context";
import { accountApi } from "@/lib/account-client";
import { useCustomer } from "@/components/order/customer-provider";

export { orderSessionLabel };

/**
 * The browsing/ordering context the customer should never lose: how they want
 * the order (delivery or pickup) and which address it goes to. Kept separate
 * from CustomerProfile because it is *this session's* choice, not saved profile
 * data - it survives navigation and reloads via localStorage.
 */
export interface OrderSession {
  fulfilment: FulfillmentMethod;
  address: DeliveryAddress | null;
  /** The station the customer last opened, so the next visit can resume there. */
  stationId: string | null;
  /** True once the persisted session has been read, so UIs don't flash empty. */
  hydrated: boolean;
}

interface OrderSessionContextValue extends OrderSession {
  setFulfilment: (method: FulfillmentMethod) => void;
  setAddress: (address: DeliveryAddress | null) => void;
  setStationId: (stationId: string | null) => void;
  /** One-tap: use the signed-in customer's saved default address. */
  useDefaultAddress: () => void;
}

const OrderSessionContext = createContext<OrderSessionContextValue | null>(null);

const STORAGE_KEY = "mf:orderSession";

interface StoredSession {
  fulfilment?: FulfillmentMethod;
  address?: DeliveryAddress | null;
  stationId?: string | null;
}

export function OrderSessionProvider({ children }: { children: ReactNode }) {
  const { profile, hydrated: profileHydrated, loggedIn, accountSynced } = useCustomer();
  const [fulfilment, setFulfilmentState] = useState<FulfillmentMethod>("delivery");
  const [address, setAddressState] = useState<DeliveryAddress | null>(null);
  const [stationId, setStationIdState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const hadStoredSession = useRef(false);
  const seededFromAccount = useRef(false);
  const lastSyncedContext = useRef<string | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate the order session from localStorage after mount */
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      hadStoredSession.current = Boolean(raw);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredSession;
        if (parsed.fulfilment === "delivery" || parsed.fulfilment === "pickup") {
          setFulfilmentState(parsed.fulfilment);
        }
        if (parsed.address && typeof parsed.address === "object") {
          setAddressState(parsed.address);
        }
        if (typeof parsed.stationId === "string" && parsed.stationId) {
          setStationIdState(parsed.stationId);
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
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ fulfilment, address, stationId } satisfies StoredSession)
      );
    } catch {
      /* noop */
    }
  }, [fulfilment, address, stationId, hydrated]);

  // A signed-in customer on a device with no saved session resumes the
  // fulfilment and station the server remembers from their last visit.
  useEffect(() => {
    if (!hydrated || !profileHydrated || !accountSynced || !loggedIn) return;
    if (seededFromAccount.current || hadStoredSession.current) return;
    seededFromAccount.current = true;
    void (async () => {
      const result = await accountApi.preferences();
      if (!result.ok) return;
      const saved = result.data.preferences;
      if (saved.fulfilment === "delivery" || saved.fulfilment === "pickup") {
        setFulfilmentState(saved.fulfilment);
      }
      if (saved.lastStationId) setStationIdState(saved.lastStationId);
    })();
  }, [hydrated, profileHydrated, accountSynced, loggedIn]);

  // Keep the account in step with this device, quietly and after the initial
  // echo so loading a page doesn't cause a write.
  useEffect(() => {
    if (!hydrated || !loggedIn) return;
    const payload = JSON.stringify({ fulfilment, lastStationId: stationId });
    if (lastSyncedContext.current === null) {
      lastSyncedContext.current = payload;
      return;
    }
    if (lastSyncedContext.current === payload) return;
    const timer = setTimeout(() => {
      lastSyncedContext.current = payload;
      void accountApi.updateOrderContext({ fulfilment, lastStationId: stationId });
    }, 800);
    return () => clearTimeout(timer);
  }, [fulfilment, stationId, hydrated, loggedIn]);

  const setFulfilment = useCallback((method: FulfillmentMethod) => setFulfilmentState(method), []);
  const setAddress = useCallback((next: DeliveryAddress | null) => setAddressState(next), []);
  const setStationId = useCallback((next: string | null) => setStationIdState(next), []);
  const useDefaultAddress = useCallback(() => {
    const saved = profile.addresses[profile.defaultAddressIndex] ?? profile.addresses[0] ?? null;
    if (saved) setAddressState(saved);
  }, [profile.addresses, profile.defaultAddressIndex]);

  const value = useMemo<OrderSessionContextValue>(
    () => ({
      fulfilment,
      address,
      stationId,
      hydrated,
      setFulfilment,
      setAddress,
      setStationId,
      useDefaultAddress,
    }),
    [fulfilment, address, stationId, hydrated, setFulfilment, setAddress, setStationId, useDefaultAddress]
  );

  return <OrderSessionContext.Provider value={value}>{children}</OrderSessionContext.Provider>;
}

export function useOrderSession(): OrderSessionContextValue {
  const ctx = useContext(OrderSessionContext);
  if (!ctx) throw new Error("useOrderSession must be used within OrderSessionProvider");
  return ctx;
}
