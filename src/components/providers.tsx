"use client";

import type { ReactNode } from "react";
import { CartProvider } from "@/components/order/cart-provider";
import { CartUiProvider } from "@/components/order/cart-ui-provider";
import { CartDrawer } from "@/components/order/cart-drawer";
import { FloatingCartBar, SwitchStationDialog } from "@/components/order/cart-entry";
import { CustomerProvider } from "@/components/order/customer-provider";
import { SendWaterProvider } from "@/components/order/send-water-provider";
import { OrderSessionProvider } from "@/components/order/order-session-provider";
import { BrowseContextProvider } from "@/components/order/browse-context";
import { OrderEntryProvider } from "@/components/order/order-entry-provider";
import { FlyToCartProvider } from "@/components/order/fly-to-cart";
import { GeoShareEngine } from "@/components/order/geo-share-engine";
import { ToastProvider } from "@/components/ui/toast";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { RefillPrompt } from "@/components/shared/refill-prompt";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <CartProvider>
        <CartUiProvider>
          <FlyToCartProvider>
            <CustomerProvider>
              <SendWaterProvider>
                <OrderSessionProvider>
                  <BrowseContextProvider>
                    <OrderEntryProvider>
                      <GeoShareEngine />
                      <OfflineBanner />
                      {children}
                      <FloatingCartBar />
                      <CartDrawer />
                      <SwitchStationDialog />
                      <RefillPrompt />
                    </OrderEntryProvider>
                  </BrowseContextProvider>
                </OrderSessionProvider>
              </SendWaterProvider>
            </CustomerProvider>
          </FlyToCartProvider>
        </CartUiProvider>
      </CartProvider>
    </ToastProvider>
  );
}
