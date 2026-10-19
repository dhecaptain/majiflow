"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { fetchOrder, postLocation } from "@/lib/orders";
import { isActiveStatus } from "@/lib/order-status";

/**
 * Invisible live-location sharing.
 *
 * While a customer has an active order open at `/order/[id]` and has agreed
 * to share their location for that order, this engine streams browser GPS
 * fixes so the station can find them. It renders nothing - the consent
 * toggle lives on the tracking page and the browser shows its own permission
 * prompt. Sharing stops when consent is withdrawn, the order closes or the
 * customer leaves the page. Denied permission falls back to the address pin.
 */

/** Fired by the tracking page after the customer changes consent. */
export const ORDER_CONSENT_EVENT = "mf:order-consent";

const POST_INTERVAL_MS = 5000;
const POST_DISTANCE_M = 15;
const STATUS_POLL_MS = 10000;

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371e3;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function GeoShareEngine() {
  const pathname = usePathname();
  const match = /^\/order\/([^/]+)$/.exec(pathname);
  const orderId = match ? match[1] : null;

  useEffect(() => {
    if (!orderId) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;

    let alive = true;
    let stopped = false;
    let watchId: number | null = null;
    let poll: number | null = null;
    let lastSent = 0;
    let lastFix: { lat: number; lng: number } | null = null;

    const stopWatch = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
    };

    const stop = () => {
      stopped = true;
      stopWatch();
      if (poll !== null) {
        window.clearInterval(poll);
        poll = null;
      }
    };

    const startWatch = () => {
      if (watchId !== null || stopped) return;
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (!alive || stopped) return;
          const fix = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          const now = Date.now();
          const moved = lastFix ? haversineMeters(lastFix, fix) : Infinity;
          const due = now - lastSent >= POST_INTERVAL_MS || moved >= POST_DISTANCE_M;
          lastFix = fix;
          if (!due) return;
          lastSent = now;
          void postLocation(orderId, {
            ...fix,
            accuracy: pos.coords.accuracy ?? undefined,
            at: new Date().toISOString(),
          }).then((ok) => {
            // The server refuses fixes once consent is gone or the order closed.
            if (!ok) void sync();
          });
        },
        () => stop(),
        { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 }
      );
    };

    const sync = async () => {
      const order = await fetchOrder(orderId);
      if (!alive || stopped) return;
      if (!order || !isActiveStatus(order.status)) {
        stop();
        return;
      }
      if (order.consent?.location) startWatch();
      else stopWatch();
    };

    const onConsent = () => void sync();
    window.addEventListener(ORDER_CONSENT_EVENT, onConsent);
    void sync();
    poll = window.setInterval(() => void sync(), STATUS_POLL_MS);

    return () => {
      alive = false;
      window.removeEventListener(ORDER_CONSENT_EVENT, onConsent);
      stop();
    };
  }, [orderId]);

  return null;
}
