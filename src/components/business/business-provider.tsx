"use client";

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { businesses as demoStations } from "@/lib/data/businesses";
import type { Business } from "@/lib/types";

/**
 * The dashboard works on one of the owner's own stations, loaded on the server
 * from the session (see `listOwnerCatalogStations` in the business layout). A
 * saved selection only counts when it is one of those stations, and the server
 * enforces the same scoping on every order and product request.
 */

const STORAGE_KEY = "mf:business";
const PLACEHOLDER: Business = { ...demoStations[0], id: "", slug: "", name: "Your station", products: [] };
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

export function resolveBusinessId(savedId: string | null, ownedIds: readonly string[] = []) {
  if (savedId && ownedIds.includes(savedId)) return savedId;
  return ownedIds[0] ?? null;
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
  stations = [],
}: {
  children: ReactNode;
  stations?: readonly Business[];
}) {
  const approvedBusinessIds = useMemo(() => stations.map((station) => station.id), [stations]);
  const businessId = useSyncExternalStore(
    subscribe,
    () => readBusinessId(approvedBusinessIds),
    () => resolveBusinessId(null, approvedBusinessIds)
  );

  // Without a station of their own the dashboard shows its setup state; the
  // placeholder only keeps components typed and is never shown as theirs.
  const business = stations.find((b) => b.id === businessId) ?? stations[0] ?? PLACEHOLDER;

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
