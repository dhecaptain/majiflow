"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CitySelect } from "@/components/home/city-select";
import { PICKUP_ENABLED } from "@/config/fulfilment";

interface DeliveryPickupModalProps {
  open: boolean;
  onClose: () => void;
}

export function DeliveryPickupModal({ open, onClose }: DeliveryPickupModalProps) {
  const [mode, setMode] = useState<"delivery" | "pickup">("delivery");
  const [city, setCity] = useState("Nairobi");
  const [location, setLocation] = useState("");

  return (
    <Dialog open={open} onClose={onClose} title={PICKUP_ENABLED ? "Delivery or Pickup" : "Set your delivery location"}>
      <div className="flex flex-col gap-4 p-6">
        {PICKUP_ENABLED && (
          <div className="grid grid-cols-2 gap-2 rounded-full bg-muted p-1">
            <button
              type="button"
              onClick={() => setMode("delivery")}
              className={`rounded-full px-4 py-2 text-sm font-medium ${mode === "delivery" ? "bg-white shadow-sm" : "text-foreground/70"}`}
            >
              Delivery
            </button>
            <button
              type="button"
              onClick={() => setMode("pickup")}
              className={`rounded-full px-4 py-2 text-sm font-medium ${mode === "pickup" ? "bg-white shadow-sm" : "text-foreground/70"}`}
            >
              Pickup
            </button>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">City</span>
          <CitySelect value={city} onChange={setCity} />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="order-location" className="text-sm font-medium text-foreground">
            Location / Estate
          </label>
          <input
            id="order-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Enter your location"
            className="h-12 w-full rounded-xl border border-border px-4 text-sm"
          />
        </div>

        <Button
          size="lg"
          className="mt-2 rounded-full"
          style={{ backgroundColor: "var(--brand)" }}
          onClick={onClose}
        >
          Confirm
        </Button>
      </div>
    </Dialog>
  );
}
