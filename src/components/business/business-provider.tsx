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
 * associated it with an approved owner application (`approvedBusinessIds`,
 * resolved from the session in the business layout). Until that association
 * exists, the dashboard must not fall back to a seeded station. The server
 * enforces the same scoping on every order request.
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
  const approved = approvedBusinessIds.filter((id) => businesses.some((business) => business.id === id));
  if (savedId && approved.includes(savedId)) return savedId;
  return approved[0] ?? null;
}

function readBusinessId(approvedBusinessIds: readonly string[]) {
  try {
    return resolveBusinessId(window.localStorage.getItem(STORAGE_KEY), approvedBusinessIds);
  } catch {
    return resolveBusinessId(null, approvedBusinessIds);
  }
}

export function BusinessProvider({
  children,
  approvedBusinessIds = [],
}: {
  children: ReactNode;
  approvedBusinessIds?: readonly string[];
}) {
  const businessId = useSyncExternalStore(
    subscribe,
    () => readBusinessId(approvedBusinessIds),
    () => resolveBusinessId(null, approvedBusinessIds)
  );

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
