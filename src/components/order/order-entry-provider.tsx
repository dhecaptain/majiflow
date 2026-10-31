"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AuthSheet } from "@/components/order/auth-sheet";
import { LocationModal } from "@/components/order/location-modal";

/**
 * The one place that owns the two doors into ordering: sign-up and location.
 *
 * The header, the hero and the order bar all need the same pair of panels, so
 * they are mounted once here and opened by name. A customer who signs up from
 * the header lands straight in the location step instead of losing their place,
 * and confirming a location from the order flow lands on browse.
 */

type AuthIntent = "order" | "account";

interface OrderEntryValue {
  /** Open the sign-up sheet. */
  openAuth: (intent?: AuthIntent) => void;
  /** Open the delivery/pickup and location sheet as a plain editor. */
  openLocation: () => void;
  /** The Order button: always the location map first, browse right after confirming. */
  startOrder: () => void;
  authOpen: boolean;
  locationOpen: boolean;
  closeAuth: () => void;
  closeLocation: () => void;
}

const OrderEntryContext = createContext<OrderEntryValue | null>(null);

export function OrderEntryProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [intent, setIntent] = useState<AuthIntent>("order");
  // Bumped on every open so the sheet starts from a clean form.
  const [authCycle, setAuthCycle] = useState(0);
  const afterConfirmRef = useRef<(() => void) | null>(null);

  const goToBrowse = useCallback(() => router.push("/browse"), [router]);

  const openAuth = useCallback((next: AuthIntent = "order") => {
    setIntent(next);
    setAuthCycle((cycle) => cycle + 1);
    setAuthOpen(true);
  }, []);
  const openLocation = useCallback(() => {
    afterConfirmRef.current = null;
    setLocationOpen(true);
  }, []);
  const startOrder = useCallback(() => {
    afterConfirmRef.current = goToBrowse;
    setLocationOpen(true);
  }, [goToBrowse]);
  const closeAuth = useCallback(() => setAuthOpen(false), []);
  const closeLocation = useCallback(() => {
    afterConfirmRef.current = null;
    setLocationOpen(false);
  }, []);

  const value = useMemo<OrderEntryValue>(
    () => ({ openAuth, openLocation, startOrder, authOpen, locationOpen, closeAuth, closeLocation }),
    [openAuth, openLocation, startOrder, authOpen, locationOpen, closeAuth, closeLocation]
  );

  return (
    <OrderEntryContext.Provider value={value}>
      {children}
      <AuthSheet
        key={authCycle}
        open={authOpen}
        intent={intent}
        onClose={closeAuth}
        onSignedIn={() => {
          closeAuth();
          if (intent === "order") startOrder();
        }}
      />
      <LocationModal
        open={locationOpen}
        onClose={closeLocation}
        onConfirm={() => {
          const after = afterConfirmRef.current;
          afterConfirmRef.current = null;
          after?.();
        }}
      />
    </OrderEntryContext.Provider>
  );
}

export function useOrderEntry(): OrderEntryValue {
  const ctx = useContext(OrderEntryContext);
  if (!ctx) throw new Error("useOrderEntry must be used within OrderEntryProvider");
  return ctx;
}
