"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Business } from "@/lib/types";

/**
 * The public station catalog, loaded on the server (see `listStations`) and
 * shared with every client component that needs stations, prices or hours.
 * Checkout re-validates against the server, so this copy is for display.
 */

const StationsContext = createContext<readonly Business[] | null>(null);

export function StationsProvider({ stations, children }: { stations: readonly Business[]; children: ReactNode }) {
  return <StationsContext.Provider value={stations}>{children}</StationsContext.Provider>;
}

export function useStations(): readonly Business[] {
  const stations = useContext(StationsContext);
  if (!stations) throw new Error("useStations must be used within StationsProvider");
  return stations;
}

export function useStation(id: string | null | undefined): Business | null {
  const stations = useStations();
  return id ? stations.find((station) => station.id === id) ?? null : null;
}
