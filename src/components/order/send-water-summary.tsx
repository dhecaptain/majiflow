"use client";

import { Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import { orderSessionLabel } from "@/components/order/order-session-provider";
import { useSendWater } from "@/components/order/send-water-provider";

/**
 * Shows the gift recipient wherever an order summary appears. Display-only:
 * the recipient lives in client state until the order payload grows recipient
 * fields (see the backend changes list).
 */
export function SendWaterSummary({ className }: { className?: string }) {
  const { sendWater } = useSendWater();
  if (!sendWater) return null;

  const { recipient, address } = sendWater;
  const where = orderSessionLabel({ fulfilment: "delivery", address });

  return (
    <div className={cn("rounded-xl border border-[var(--brand)]/25 bg-cta-soft p-3.5", className)}>
      <p className="flex items-center gap-2 text-sm font-semibold text-[var(--brand)]">
        <Gift className="size-4 shrink-0" aria-hidden />
        Sending to {recipient.name}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-foreground/80">
        {where}
        {address.landmark?.trim() ? ` · ${address.landmark.trim()}` : ""}
        {recipient.phone ? ` · ${recipient.phone}` : ""}
      </p>
      {recipient.message && (
        <p className="mt-1.5 border-l-2 border-[var(--brand)]/30 pl-2.5 text-xs italic leading-relaxed text-muted-foreground">
          “{recipient.message}”
        </p>
      )}
    </div>
  );
}
