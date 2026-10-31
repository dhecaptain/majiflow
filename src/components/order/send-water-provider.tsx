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
import { useRouter } from "next/navigation";
import type { DeliveryAddress } from "@/lib/types";
import { SendWaterModal } from "@/components/order/send-water-modal";

/**
 * "Send water" = an order whose destination is someone else's door.
 *
 * The recipient and message are kept in sessionStorage only: the order payload
 * and the database have no recipient fields yet, and this flow must not change
 * them. The moment the backend grows those fields this state should move into
 * the order draft.
 */

export interface SendWaterRecipient {
  name: string;
  phone: string;
  message: string;
}

export interface SendWaterState {
  recipient: SendWaterRecipient;
  address: DeliveryAddress;
}

interface SendWaterValue {
  sendWater: SendWaterState | null;
  /** True once any persisted gift state has been read back. */
  hydrated: boolean;
  openSendWater: () => void;
  closeSendWater: () => void;
  clearSendWater: () => void;
}

const SendWaterContext = createContext<SendWaterValue | null>(null);

const STORAGE_KEY = "mf:sendWater";

function parseStored(raw: string | null): SendWaterState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SendWaterState;
    if (
      parsed &&
      typeof parsed.recipient?.name === "string" &&
      typeof parsed.recipient?.phone === "string" &&
      parsed.address &&
      typeof parsed.address === "object"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function SendWaterProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [sendWater, setSendWater] = useState<SendWaterState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate session state after mount
      setSendWater(parseStored(window.sessionStorage.getItem(STORAGE_KEY)));
    } catch {
      /* noop */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (sendWater) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sendWater));
      else window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
  }, [sendWater, hydrated]);

  const openSendWater = useCallback(() => setModalOpen(true), []);
  const closeSendWater = useCallback(() => setModalOpen(false), []);
  const clearSendWater = useCallback(() => setSendWater(null), []);

  const confirmSendWater = useCallback(
    (next: SendWaterState) => {
      setSendWater(next);
      setModalOpen(false);
      router.push("/browse");
    },
    [router]
  );

  const value = useMemo<SendWaterValue>(
    () => ({ sendWater, hydrated, openSendWater, closeSendWater, clearSendWater }),
    [sendWater, hydrated, openSendWater, closeSendWater, clearSendWater]
  );

  return (
    <SendWaterContext.Provider value={value}>
      {children}
      <SendWaterModal
        open={modalOpen}
        initial={sendWater}
        onClose={closeSendWater}
        onConfirm={confirmSendWater}
      />
    </SendWaterContext.Provider>
  );
}

export function useSendWater(): SendWaterValue {
  const ctx = useContext(SendWaterContext);
  if (!ctx) throw new Error("useSendWater must be used within SendWaterProvider");
  return ctx;
}
