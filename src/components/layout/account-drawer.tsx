"use client";

import { useCallback, useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  Bell,
  ChevronRight,
  Clock,
  Download,
  Droplets,
  Gift,
  Info,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MapPin,
  ShieldCheck,
  Store,
  X,
} from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";
import { MajiMark } from "@/components/layout/maji-mark";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useCustomer } from "@/components/order/customer-provider";
import { useOrderEntry } from "@/components/order/order-entry-provider";
import { useSendWater } from "@/components/order/send-water-provider";
import { usePwaInstall } from "@/lib/pwa-install";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { cn } from "@/lib/utils";

interface DrawerLink {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

const SHOP_LINKS: DrawerLink[] = [
  { href: "/browse", label: "Order water", icon: Droplets },
];

const ACCOUNT_LINKS: DrawerLink[] = [
  { href: "/account/orders", label: "Order history", icon: Clock },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account", label: "Account & privacy", icon: ShieldCheck },
  { href: "/account/notifications", label: "Communication preferences", icon: Bell },
];

const HELP_LINKS: DrawerLink[] = [
  { href: "/contact", label: "Get help", icon: LifeBuoy },
  { href: "/business/register", label: "Become a vendor", icon: Store },
];

const GUEST_LINKS: DrawerLink[] = [
  { href: "/contact", label: "Get help", icon: LifeBuoy },
  { href: "/about", label: "About", icon: Info },
  { href: "/business/register", label: "Become a vendor", icon: Store },
];

const BUSINESS_LINKS: DrawerLink[] = [
  { href: "/business", label: "Business overview", icon: LayoutDashboard },
  { href: "/business/applications", label: "Applications", icon: Clock },
  { href: "/business/orders", label: "Station orders", icon: Droplets },
  { href: "/business/products", label: "Products", icon: Store },
  { href: "/business/analytics", label: "Analytics", icon: ShieldCheck },
  { href: "/business/settings", label: "Settings", icon: Bell },
];

function initialsFor(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

const ROW_CLASS =
  "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function DrawerRow({
  item,
  onClose,
}: {
  item: DrawerLink;
  onClose: () => void;
}) {
  return (
    <Link href={item.href} onClick={onClose} className={ROW_CLASS}>
      <span aria-hidden className="size-5 shrink-0 text-[var(--brand)]">
        <item.icon className="size-full" />
      </span>
      {item.label}
    </Link>
  );
}

function InstallPromo() {
  const { canInstall, installed, install } = usePwaInstall();
  const { toast } = useToast();

  if (installed) return null;

  const onInstall = async () => {
    const accepted = await install();
    if (!accepted) {
      toast({
        kind: "info",
        title: "Add MajiFlow to your home screen",
        message: "Open your browser menu and choose “Add to Home screen”.",
      });
    }
  };

  return (
    <div className="shrink-0 border-t border-border px-4 py-4">
      <div className="flex items-center gap-3">
        <span className="size-14 shrink-0 overflow-hidden rounded-2xl">
          <MajiMark />
        </span>
        <p className="whitespace-pre-line font-display text-2xl font-bold leading-tight text-foreground">
          Install the{"\n"}MajiFlow app
        </p>
      </div>
      <button
        type="button"
        onClick={() => void onInstall()}
        className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-full bg-muted px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Download className="size-4" aria-hidden />
        {canInstall ? "Add to home screen" : "How to install"}
      </button>
    </div>
  );
}

/**
 * Account/navigation drawer. The hamburger opens it from the left; the optional
 * right side keeps it usable from the existing account trigger where needed.
 */
export function AccountDrawer({
  open,
  onClose,
  side = "right",
}: {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { loggedIn, profile, logout } = useCustomer();
  const { openAuth } = useOrderEntry();
  const { openSendWater } = useSendWater();
  const drawerRef = useFocusTrap<HTMLElement>(open);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const close = useCallback(() => {
    setConfirmSignOut(false);
    setSignOutError(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, close]);

  const signOut = async () => {
    setSigningOut(true);
    setSignOutError(null);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Could not sign out.");
      logout();
      setConfirmSignOut(false);
      onClose();
      router.replace("/login");
      router.refresh();
    } catch {
      setSignOutError("Could not sign out. Check your connection and try again.");
      setSigningOut(false);
    }
  };

  const name = profile.name.trim();
  const business = pathname.startsWith("/business");

  return (
    <>
      <button
        type="button"
        aria-label="Close menu"
        tabIndex={open ? 0 : -1}
        onClick={close}
        className={cn(
          "fixed inset-0 h-auto rounded-none bg-black/50 p-0 transition-opacity duration-300 hover:bg-black/50 motion-reduce:transition-none",
          confirmSignOut ? "z-40" : "z-[100]",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />
      <aside
        ref={drawerRef}
        id="account-menu"
        aria-label="Account menu"
        aria-modal={open ? true : undefined}
        role={open ? "dialog" : undefined}
        inert={!open}
        aria-hidden={!open}
        className={cn(
          "fixed inset-y-0 flex w-full max-w-[380px] flex-col bg-background pt-[env(safe-area-inset-top)] shadow-xl transition-transform duration-300 ease-out motion-reduce:transition-none",
          confirmSignOut ? "z-50" : "z-[101]",
          side === "left" ? "left-0" : "right-0",
          open ? "translate-x-0" : side === "left" ? "-translate-x-full" : "translate-x-full"
        )}
      >
        <div className="flex h-12 shrink-0 items-center gap-4 px-4">
          <button
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="-ml-2 flex size-10 shrink-0 items-center justify-center rounded-md text-foreground transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
          >
            <X className="size-6" aria-hidden />
          </button>
          <BrandMark compact />
        </div>

        {loggedIn ? (
          <div className="flex items-center gap-3 px-4 py-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] font-display text-xl font-bold text-white">
              {initialsFor(name)}
            </span>
            <div className="min-w-0">
              <p className="font-display text-2xl font-bold leading-tight text-foreground">
                {name ? `Hi ${firstName(name)}!` : "Hi there!"}
              </p>
              <Link
                href="/account/profile"
                onClick={close}
                className="flex items-center gap-1 text-sm text-foreground underline underline-offset-2"
              >
                Edit personal info
                <ChevronRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 px-4 py-4">
            <Button
              className="h-9 rounded-full px-6"
              onClick={() => {
                close();
                openAuth("account");
              }}
            >
              Sign in
            </Button>
          </div>
        )}

        <nav className="flex flex-1 flex-col overflow-y-auto px-2 py-1">
          {SHOP_LINKS.map((item) => (
            <DrawerRow key={item.href} item={item} onClose={close} />
          ))}
          <button type="button" onClick={() => { close(); openSendWater(); }} className={ROW_CLASS}>
            <span aria-hidden className="size-5 shrink-0 text-[var(--brand)]">
              <Gift className="size-full" />
            </span>
            Send water
          </button>

          {loggedIn
            ? [...ACCOUNT_LINKS, ...HELP_LINKS].map((item) => (
                <DrawerRow key={item.href} item={item} onClose={close} />
              ))
            : GUEST_LINKS.map((item) => (
                <DrawerRow key={item.href} item={item} onClose={close} />
              ))}

          {business
            ? BUSINESS_LINKS.map((item) => <DrawerRow key={item.href} item={item} onClose={close} />)
            : null}

          {loggedIn ? (
            <button
              type="button"
              onClick={() => setConfirmSignOut(true)}
              className="flex h-auto items-center justify-start gap-3 rounded-lg px-3 py-3 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span aria-hidden className="size-5 shrink-0 text-[var(--brand)]">
                <LogOut className="size-full" />
              </span>
              Sign out
            </button>
          ) : (
            <Link
              href="/login"
              onClick={close}
              className="mt-2 flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5"
            >
              <span aria-hidden className="size-5 shrink-0 text-[var(--brand)]">
                <ArrowRight className="size-full" />
              </span>
              Log in
            </Link>
          )}
        </nav>

        <InstallPromo />
      </aside>

      <Dialog
        open={confirmSignOut}
        onClose={() => {
          setConfirmSignOut(false);
          setSignOutError(null);
        }}
        title="Sign out?"
        description="You'll need to sign in again to place an order."
      >
        {signOutError ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            {signOutError}
          </p>
        ) : null}
        <div className="mt-5 flex gap-3">
          <Button variant="outline" className="flex-1 rounded-full" onClick={() => setConfirmSignOut(false)}>
            Cancel
          </Button>
          <Button className="flex-1 rounded-full" onClick={() => void signOut()} loading={signingOut}>
            Sign out
          </Button>
        </div>
      </Dialog>
    </>
  );
}
