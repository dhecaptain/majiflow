"use client";

import { useState } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import { DeliveryPickupModal } from "@/components/order/delivery-pickup-modal";
import { PICKUP_ENABLED } from "@/config/fulfilment";

export function OrderTypeBar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="sticky top-16 z-40 border-b border-border bg-white">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <MapPin className="size-5 text-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Order type / Choose service</p>
              <p className="truncate text-xs text-foreground/70">
                {PICKUP_ENABLED ? "Delivery or Pickup · Set location" : "Delivery · Set location"}
              </p>
            </div>
            <ChevronDown className="size-4 text-foreground/70" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-sm font-semibold text-[var(--brand)]"
          >
            Edit
          </button>
        </div>
      </div>
      <DeliveryPickupModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
