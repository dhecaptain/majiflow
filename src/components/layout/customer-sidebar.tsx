"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  Droplets,
  Headphones,
  Home,
  LayoutDashboard,
  LogOut,
  MapPin,
  MessageCircle,
  Package,
  ShoppingCart,
  User,
} from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";
import { addressLabel } from "@/components/layout/site-header";
import { useCart } from "@/components/order/cart-provider";
import { useCustomer } from "@/components/order/customer-provider";
import { useOrderEntry } from "@/components/order/order-entry-provider";
import { useOrderSession } from "@/components/order/order-session-provider";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/** `localStorage` flag the head script reads so a signed-in desktop paints with the sidebar. */
export const SIGNED_IN_ATTR = "data-signed-in";

/**
 * Customer pages that keep the signed-in sidebar on desktop. Business, admin,
 * rider, sign-in and the company pages keep their own layouts.
 */
export function showsCustomerSidebar(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/browse" ||
    pathname.startsWith("/browse/") ||
    pathname === "/cart" ||
    pathname === "/checkout" ||
    pathname.startsWith("/order/") ||
    pathname === "/account" ||
    pathname.startsWith("/account/") ||
    pathname === "/faqs" ||
    pathname === "/contact"
  );
}

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  match: (pathname: string) => boolean;
};

const SHOP: NavItem[] = [
  { href: "/", label: "Home", icon: Home, match: (p) => p === "/" },
  { href: "/browse", label: "Stations", icon: Droplets, match: (p) => p === "/browse" || p.startsWith("/browse/") },
];

const ACCOUNT: NavItem[] = [
  { href: "/account", label: "Overview", icon: LayoutDashboard, match: (p) => p === "/account" },
  {
    href: "/account/orders",
    label: "Orders",
    icon: Package,
    match: (p) => p.startsWith("/account/orders") || p.startsWith("/order/"),
  },
  { href: "/account/notifications", label: "Notifications", icon: Bell, match: (p) => p.startsWith("/account/notifications") },
  { href: "/account/profile", label: "Profile", icon: User, match: (p) => p.startsWith("/account/profile") },
  { href: "/account/addresses", label: "Addresses", icon: MapPin, match: (p) => p.startsWith("/account/addresses") },
];

const HELP: NavItem[] = [
  { href: "/faqs", label: "FAQs", icon: MessageCircle, match: (p) => p === "/faqs" },
  { href: "/contact", label: "Support", icon: Headphones, match: (p) => p === "/contact" },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Ends the server session, then clears the signed-in state on this device. */
export function useSignOut() {
  const router = useRouter();
  const { logout } = useCustomer();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  const signOut = async () => {
    if (pending) return;
    setPending(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) throw new Error("logout failed");
      logout();
      router.replace("/");
      router.refresh();
    } catch {
      toast({ kind: "error", title: "Could not sign out", message: "Check your connection and try again." });
    } finally {
      setPending(false);
    }
  };

  return { signOut, pending };
}

/**
 * The signed-in customer's navigation on desktop. It replaces the site header
 * on every customer page, so moving between stations, the cart and the account
 * never leaves the app layout. The markup is server-rendered on the pages in
 * `showsCustomerSidebar` and revealed by `html[data-signed-in]` (see
 * globals.css), which the head script sets before paint for returning
 * customers and this component keeps in step with the session.
 */
export function CustomerSidebar() {
  const pathname = usePathname() ?? "/";
  const { loggedIn, hydrated, profile } = useCustomer();
  const { count } = useCart();
  const { openLocation } = useOrderEntry();
  const { address, fulfilment } = useOrderSession();
  const { signOut, pending } = useSignOut();

  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    if (loggedIn) root.setAttribute(SIGNED_IN_ATTR, "true");
    else root.removeAttribute(SIGNED_IN_ATTR);
  }, [hydrated, loggedIn]);

  if (!showsCustomerSidebar(pathname)) return null;

  const name = profile.name.trim();
  const location = addressLabel(address);
  const cartActive = pathname === "/cart" || pathname === "/checkout";

  return (
    <aside
      data-customer-sidebar
      aria-label="Your MajiFlow"
      className="customer-sidebar fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-[#e6eef8] bg-white"
    >
      <div className="flex h-[72px] shrink-0 items-center px-6">
        <BrandMark compact />
      </div>

      <div className="px-4">
        <button
          type="button"
          onClick={() => openLocation()}
          className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-left transition-colors hover:border-[var(--brand)]/40 hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
        >
          <MapPin className="size-[18px] shrink-0 text-[var(--brand)]" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold text-muted-foreground">
              {fulfilment === "pickup" ? "Pick up near" : "Deliver to"}
            </span>
            <span className="block truncate text-sm font-bold text-foreground">{location || "Set your location"}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </div>

      <nav aria-label="Main" className="mt-4 flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-4">
        <SidebarHeading>Shop</SidebarHeading>
        {SHOP.map((item) => (
          <SidebarLink key={item.href} item={item} active={item.match(pathname)} />
        ))}
        <SidebarLink
          item={{ href: "/cart", label: "Cart", icon: ShoppingCart, match: () => cartActive }}
          active={cartActive}
          badge={count > 0 ? String(count) : undefined}
        />

        <SidebarHeading>My account</SidebarHeading>
        {ACCOUNT.map((item) => (
          <SidebarLink key={item.href} item={item} active={item.match(pathname)} />
        ))}

        <SidebarHeading>Help</SidebarHeading>
        {HELP.map((item) => (
          <SidebarLink key={item.href} item={item} active={item.match(pathname)} />
        ))}
      </nav>

      <div className="shrink-0 border-t border-[#eef3fa] p-3">
        <div className="flex items-center gap-3 rounded-lg p-2">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-extrabold text-white"
          >
            {initials(name)}
          </span>
          <Link href="/account/profile" className="min-w-0 flex-1 rounded-md hover:underline">
            <span className="block truncate text-sm font-bold text-foreground">{name || "Your account"}</span>
            <span className="block truncate text-xs text-muted-foreground">{profile.phone || "Signed in"}</span>
          </Link>
          <button
            type="button"
            onClick={signOut}
            disabled={pending}
            aria-label="Sign out"
            title="Sign out"
            className="flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] disabled:opacity-50"
          >
            <LogOut className="size-[18px]" aria-hidden />
          </button>
        </div>
      </div>
    </aside>
  );
}

function SidebarHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1.5 pt-5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground first:pt-1">
      {children}
    </p>
  );
}

function SidebarLink({ item, active, badge }: { item: NavItem; active?: boolean; badge?: string }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--brand)]",
        active ? "bg-brand-soft font-bold text-brand-deep" : "font-semibold text-foreground/80 hover:bg-surface-2 hover:text-foreground"
      )}
    >
      {active && <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-[var(--brand)]" />}
      <Icon className={cn("size-[18px]", active ? "text-[var(--brand)]" : "text-muted-foreground")} aria-hidden />
      {item.label}
      {badge && (
        <span className="ml-auto flex min-w-5 items-center justify-center rounded-full bg-[var(--brand)] px-1.5 py-0.5 text-[11px] font-bold text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}
