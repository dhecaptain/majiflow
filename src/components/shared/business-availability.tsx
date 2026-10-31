"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import type { WeeklyOperatingHours } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  BUSINESS_TIME_ZONE,
  getBusinessAvailability,
  type BusinessAvailability as Availability,
} from "@/lib/business-hours";

export function useBusinessAvailability(hours: WeeklyOperatingHours | undefined) {
  const [availability, setAvailability] = useState<Availability>({
    state: "unknown",
    hoursLabel: "Hours unavailable",
  });

  useEffect(() => {
    const refresh = () => setAvailability(getBusinessAvailability(hours));
    refresh();
    const interval = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(interval);
  }, [hours]);

  return availability;
}

const stateStyles = {
  open: "bg-success-soft text-success",
  closed: "bg-danger-soft text-danger",
  unknown: "bg-warning-soft text-warning",
};

const stateText = {
  open: "text-success",
  closed: "text-danger",
  unknown: "text-warning",
};

export function BusinessAvailability({
  hours,
  compact,
  plain,
  className,
}: {
  hours: WeeklyOperatingHours | undefined;
  compact?: boolean;
  /** Render as plain text: no pill background and no dot. */
  plain?: boolean;
  className?: string;
}) {
  const availability = useBusinessAvailability(hours);
  const stateLabel = availability.state === "unknown" ? "Unknown" : availability.state === "open" ? "Open" : "Closed";

  return (
    <div className={cn("flex flex-wrap items-center gap-2 text-xs", compact ? "mt-3" : "mt-4", className)} aria-live="polite">
      {plain ? (
        <span className={cn("font-semibold", stateText[availability.state])}>{stateLabel}</span>
      ) : (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold capitalize ${stateStyles[availability.state]}`}>
          <span className="size-1.5 rounded-full bg-current" aria-hidden />
          {stateLabel}
        </span>
      )}
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Clock className="size-3.5" aria-hidden />
        {availability.hoursLabel}
      </span>
      {!compact && <span className="text-muted-foreground">{BUSINESS_TIME_ZONE.replace("Africa/", "")} time</span>}
    </div>
  );
}
