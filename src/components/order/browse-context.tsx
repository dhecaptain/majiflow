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
import { usePathname } from "next/navigation";
import type { Business, DeliveryAddress } from "@/lib/types";
import type { CartLine } from "@/lib/cart";
import { cartStationId } from "@/lib/cart";
import { businesses } from "@/lib/data/businesses";
import { useCart } from "@/components/order/cart-provider";
import { useOrderSession } from "@/components/order/order-session-provider";

export type BrowseStep = "order" | "location" | "station" | "cart";
export type BrowseWaterCategory = "refills" | "new-bottles" | "bottled-packs" | "dispensers";

export interface BrowseOrderChoice {
  category: BrowseWaterCategory | null;
  size: string | null;
  quantity: number;
}

interface BrowseJourneyState {
  currentStep: BrowseStep;
  orderChoice: BrowseOrderChoice;
}

interface BrowseContextValue {
  currentStep: BrowseStep | null;
  orderChoice: BrowseOrderChoice;
  location: DeliveryAddress | null;
  selectedStation: Business | null;
  cart: CartLine[];
  addToCart: (line: CartLine) => void;
  updateCartQuantity: (line: CartLine, quantity: number) => void;
  canGoToStep: (step: BrowseStep) => boolean;
  setCurrentStep: (step: BrowseStep) => void;
  setOrderChoice: (choice: Partial<BrowseOrderChoice>) => void;
  setLocation: (location: DeliveryAddress | null) => void;
  selectStation: (stationId: string | null) => void;
}

const BrowseContext = createContext<BrowseContextValue | null>(null);
const STORAGE_KEY = "mf:browseJourney";
const STEP_ORDER: BrowseStep[] = ["order", "location", "station", "cart"];
const DEFAULT_JOURNEY: BrowseJourneyState = {
  currentStep: "order",
  orderChoice: { category: null, size: null, quantity: 1 },
};

function isStep(value: unknown): value is BrowseStep {
  return value === "order" || value === "location" || value === "station" || value === "cart";
}

function readJourney(): BrowseJourneyState {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!raw || typeof raw !== "object") return DEFAULT_JOURNEY;
    const saved = raw as Partial<BrowseJourneyState>;
    const choice = saved.orderChoice;
    const validCategory =
      choice?.category === "refills" ||
      choice?.category === "new-bottles" ||
      choice?.category === "bottled-packs" ||
      choice?.category === "dispensers";
    return {
      currentStep: isStep(saved.currentStep) ? saved.currentStep : "order",
      orderChoice: {
        category: validCategory ? choice.category : null,
        size: typeof choice?.size === "string" ? choice.size : null,
        quantity:
          typeof choice?.quantity === "number" && Number.isFinite(choice.quantity)
            ? Math.max(1, Math.min(20, Math.floor(choice.quantity)))
            : 1,
      },
    };
  } catch {
    return DEFAULT_JOURNEY;
  }
}

function resolveRouteStep(pathname: string): BrowseStep | null {
  if (pathname === "/") return "order";
  if (pathname === "/browse" || pathname.startsWith("/browse?")) return null;
  if (/^\/browse\/[^/]+/.test(pathname)) return "station";
  if (pathname === "/cart" || pathname === "/checkout" || pathname.startsWith("/order/")) {
    return "cart";
  }
  return null;
}

export function BrowseContextProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const session = useOrderSession();
  const { setAddress, setStationId } = session;
  const { items, addItem, updateQuantity } = useCart();
  const [journey, setJourney] = useState<BrowseJourneyState>(DEFAULT_JOURNEY);
  const [hydrated, setHydrated] = useState(false);
  const onBrowseRoute = pathname === "/browse" || pathname.startsWith("/browse/");
  const selectedId = onBrowseRoute
    ? session.stationId ?? cartStationId(items)
    : cartStationId(items) ?? session.stationId;
  const selectedStation = selectedId
    ? businesses.find((business) => business.id === selectedId) ?? null
    : null;

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- restore the saved Browse step and order choices */
    setJourney(readJourney());
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(journey));
    } catch {
      /* noop */
    }
  }, [journey, hydrated]);

  const routeStep = resolveRouteStep(pathname);
  const currentStep = routeStep ?? journey.currentStep;
  const orderReady = Boolean(
    journey.orderChoice.category &&
      journey.orderChoice.size &&
      journey.orderChoice.quantity > 0
  );

  const canGoToStep = useCallback(
    (step: BrowseStep) => {
      const index = STEP_ORDER.indexOf(step);
      if (index === 0) return true;
      if (index === 1) return orderReady;
      if (index === 2) return orderReady && Boolean(session.address);
      return Boolean(selectedStation) && (items.length > 0 || (orderReady && Boolean(session.address)));
    },
    [items.length, orderReady, selectedStation, session.address]
  );

  const setCurrentStep = useCallback((step: BrowseStep) => {
    setJourney((previous) => ({ ...previous, currentStep: step }));
  }, []);

  const setOrderChoice = useCallback((choice: Partial<BrowseOrderChoice>) => {
    setJourney((previous) => ({
      ...previous,
      orderChoice: { ...previous.orderChoice, ...choice },
    }));
  }, []);

  const setLocation = useCallback((location: DeliveryAddress | null) => {
    setAddress(location);
  }, [setAddress]);

  const selectStation = useCallback((stationId: string | null) => {
    setStationId(stationId);
  }, [setStationId]);

  const value = useMemo<BrowseContextValue>(
    () => ({
      currentStep,
      orderChoice: journey.orderChoice,
      location: session.address,
      selectedStation,
      cart: items,
      addToCart: addItem,
      updateCartQuantity: updateQuantity,
      canGoToStep,
      setCurrentStep,
      setOrderChoice,
      setLocation,
      selectStation,
    }),
    [
      currentStep,
      journey.orderChoice,
      session.address,
      selectedStation,
      items,
      addItem,
      updateQuantity,
      canGoToStep,
      setCurrentStep,
      setOrderChoice,
      setLocation,
      selectStation,
    ]
  );

  return <BrowseContext.Provider value={value}>{children}</BrowseContext.Provider>;
}

export function useBrowseContext(): BrowseContextValue {
  const context = useContext(BrowseContext);
  if (!context) throw new Error("useBrowseContext must be used within BrowseContextProvider");
  return context;
}
