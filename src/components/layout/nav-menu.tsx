"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { UserRound, X } from "lucide-react";
import { AccountDrawer } from "@/components/layout/account-drawer";
import { useCustomer } from "@/components/order/customer-provider";

/**
 * Account trigger retained for layouts that need a standalone profile button.
 * The current shared header uses the hamburger entry point instead.
 */
export function NavMenu() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { profile } = useCustomer();
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- portals need the DOM, which only exists after mount */
    setMounted(true);
  }, []);

  const name = profile.name.trim().split(/\s+/)[0] ?? "";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="account-menu"
        aria-label={open ? "Close account menu" : "Open account menu"}
        className="flex h-11 max-w-[11rem] items-center gap-2 rounded-md px-2 text-foreground transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
      >
        {open ? (
          <X className="size-6 shrink-0" aria-hidden />
        ) : (
          <UserRound className="size-6 shrink-0" strokeWidth={2.75} aria-hidden />
        )}
        <span className="truncate text-sm font-bold">{name || "Account"}</span>
      </button>

      {mounted ? createPortal(<AccountDrawer open={open} onClose={close} />, document.body) : null}
    </>
  );
}
