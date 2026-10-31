"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Tab-cycle trap for hand-rolled dialogs (sheets and modals that cannot use
 * the shared Dialog because they own their own layout). Attach the returned
 * ref to the panel element; returns nothing else the caller needs.
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!active) return;
    const panel = ref.current;
    if (!panel) return;
    const prev = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => {
      const target =
        panel.querySelector<HTMLElement>("[data-autofocus]") ?? panel.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus();
    }, 60);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusables = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    panel.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      panel.removeEventListener("keydown", onKeyDown);
      prev?.focus();
    };
  }, [active]);

  return ref;
}
