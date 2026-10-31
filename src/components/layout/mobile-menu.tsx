"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";
import { AccountDrawer } from "@/components/layout/account-drawer";

/** The hamburger opens the existing account and site links from the left. */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- the drawer uses a document portal */
    setMounted(true);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="account-menu"
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        className="flex size-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
      </button>
      {mounted ? createPortal(<AccountDrawer open={open} onClose={close} side="left" />, document.body) : null}
    </>
  );
}
