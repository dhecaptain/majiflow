"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { businesses } from "@/lib/data/businesses";
import type { Business } from "@/lib/types";

/**
 * A business dashboard station may only be selected when the server has
 * associated it with an approved owner application. Until that association
 * exists, the dashboard must not fall back to a seeded station.
 */

const STORAGE_KEY = "mf:business";
interface BusinessContextValue {
  business: Business;
  hasBusiness: boolean;
}

const BusinessContext = createContext<BusinessContextValue | null>(null);

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = () => listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function resolveBusinessId(savedId: string | null, approvedBusinessIds: readonly string[] = []) {
  if (!savedId || !approvedBusinessIds.includes(savedId)) return null;
  return businesses.some((business) => business.id === savedId) ? savedId : null;
}

function readBusinessId() {
  try {
    return resolveBusinessId(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

const getServerSnapshot = () => null;

export function BusinessProvider({ children }: { children: ReactNode }) {
  const businessId = useSyncExternalStore(subscribe, readBusinessId, getServerSnapshot);

  const business = businesses.find((b) => b.id === businessId) ?? businesses[0];

  return (
    <BusinessContext.Provider value={{ business, hasBusiness: businessId !== null }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness(): BusinessContextValue {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error("useBusiness must be used within BusinessProvider");
  return ctx;
}
