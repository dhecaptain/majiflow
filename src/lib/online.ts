"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function getSnapshot(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

/** The server cannot know the connection state, so assume online to match SSR. */
function getServerSnapshot(): boolean {
  return true;
}

/** Current network reachability, kept in sync with the browser's events. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
