"use client";

import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { useSendWater } from "@/components/order/send-water-provider";

/**
 * Anywhere "Send water" is tapped - landing banner, menu, browse - this opens
 * the same destination sheet. Styling is passed through so each entry keeps
 * its own design.
 */
export function SendWaterTrigger({ onClick, ...props }: ComponentProps<typeof Button>) {
  const { openSendWater } = useSendWater();
  return (
    <Button
      onClick={(event) => {
        onClick?.(event);
        openSendWater();
      }}
      {...props}
    />
  );
}
