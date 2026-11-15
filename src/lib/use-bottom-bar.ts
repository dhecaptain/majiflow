"use client";

import { useEffect } from "react";

/**
 * While a fixed bar owns the bottom of a phone screen (the cart bar on a
 * station, the cart and checkout action bars), lift toasts and prompts above
 * it. See `[data-bottom-bar]` in globals.css; from `lg` up nothing moves.
 */
export function useBottomBarLift(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    root.dataset.bottomBar = "true";
    return () => {
      delete root.dataset.bottomBar;
    };
  }, [active]);
}
