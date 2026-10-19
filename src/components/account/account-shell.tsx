"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Bell,
  CreditCard,
  Droplets,
  Headphones,
  LayoutDashboard,
  MapPin,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Package,
  Search,
  ShoppingCart,
  User,
} from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";
import { WaterDrawer } from "@/components/ui/water-drawer";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { PageTransition } from "@/components/layout/page-transition";
import waterLiquid from "@/assets/images/backdrops/water-liquid.webp";
import { useCart } from "@/components/order/cart-provider";
import { useCustomer } from "@/components/order/customer-provider";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

const NAV: NavItem[] = [
  { href: "/account", label: "Overview", icon: LayoutDashboard },
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/account/notifications", label: "Notifications", icon: Bell },
  { href: "/account/profile", label: "Profile", icon: User },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/plans", label: "Plans", icon: CreditCard },
];

const SHOP: NavItem[] = [{ href: "/browse", label: "Browse water", icon: Droplets }];

const HELP: NavItem[] = [
  { href: "/faqs", label: "FAQs", icon: MessageCircle },
  { href: "/contact", label: "Support", icon: Headphones },
];

export function AccountShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const { count } = useCart();
  const { profile, logout } = useCustomer();

  const name = profile.name || "";
  const initial = name ? name.trim().slice(0, 1).toUpperCase() : "U";

  const signOut = async () => {
    setLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Could not sign out.");
      logout();
      router.replace("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  };

  const nav = (
    <nav aria-label="Account" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
      {NAV.map((item) => (
        <SidebarLink
          key={item.href}
          href={item.href}
          label={item.label}
          icon={item.icon}
          active={pathname === item.href || (item.href !== "/account" && pathname.startsWith(`${item.href}/`))}
          onClick={() => setOpen(false)}
        />
      ))}

      <p className="px-3 pb-1 pt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-foreground">
        Shop
      </p>
      {SHOP.map((item) => (
        <SidebarLink
          key={item.href}
          href={item.href}
          label={item.label}
          icon={item.icon}
          active={pathname === item.href}
          onClick={() => setOpen(false)}
        />
      ))}
      <SidebarLink
        href="/cart"
        label="Cart"
        icon={ShoppingCart}
        active={pathname === "/cart"}
        badge={count > 0 ? String(count) : undefined}
        onClick={() => setOpen(false)}
      />

      <p className="px-3 pb-1 pt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-foreground">
        Help
      </p>
      {HELP.map((item) => (
        <SidebarLink
          key={item.href}
          href={item.href}
          label={item.label}
          icon={item.icon}
          onClick={() => setOpen(false)}
        />
      ))}

      {/* User card */}
      <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-border bg-white px-3 py-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted font-display text-sm text-foreground">
          {initial}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{name || "Guest"}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {profile.phone || "Sign in to sync orders"}
          </p>
        </div>
      </div>
    </nav>
  );

  const header = (
    <>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="flex size-10 items-center justify-center rounded-xl border border-border bg-white lg:hidden"
          onClick={() => setOpen(true)}
          aria-label="Open dashboard menu"
        >
          <Menu className="size-5" aria-hidden />
        </button>
        <div className="relative hidden items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 md:flex">
          <Search className="size-4 text-black" aria-hidden />
          <input
            className="w-44 bg-white text-sm text-foreground outline-none placeholder:text-foreground"
            placeholder="Search orders, stations…"
            aria-label="Search your account"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/account/notifications"
          aria-label="Notifications"
          className="relative flex size-10 items-center justify-center rounded-xl border border-border bg-white text-foreground transition-colors hover:text-[#0052FF]"
        >
          <Bell className="size-4.5" aria-hidden />
        </Link>
        <Link
          href="/cart"
          aria-label={`Cart, ${count} items`}
          className="relative flex size-10 items-center justify-center rounded-xl border border-border bg-white text-foreground hover:text-foreground"
        >
          <ShoppingCart className="size-4.5" aria-hidden />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-foreground text-[11px] font-bold text-white shadow-accent ring-2 ring-white">
              {count}
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={signOut}
          disabled={loggingOut}
          className="rounded-xl bg-foreground px-3 py-2 text-sm font-semibold text-white shadow-accent disabled:opacity-50"
        >
          {loggingOut ? "Signing out…" : "Log out"}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-white lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-border px-5">
          <BrandMark className="scale-90" />
        </div>
        {nav}
      </aside>

      {/* Mobile drawer */}
      <WaterDrawer open={open} onClose={() => setOpen(false)}>
        {nav}
      </WaterDrawer>

      {/* Content column */}
      <div className="relative flex min-h-screen flex-col lg:pl-64">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-y-0 left-0 right-0 z-0 lg:left-64"
        >
          <Image
            src={waterLiquid}
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/25 via-background/50 to-background/80" />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-radial-glow"
        />

        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-white/80 px-4 backdrop-blur-md sm:px-6">
          {header}
        </header>

        <main className="relative flex-1 p-4 pb-24 sm:p-6 lg:pb-6">
          <PageTransition>{children}</PageTransition>
        </main>

        <footer className="relative border-t border-border bg-white/60">
          <div className="mx-auto flex max-w-[80rem] flex-wrap items-center justify-between gap-4 px-4 pb-24 pt-3 text-xs text-foreground sm:px-6 lg:pb-3">
            <p>MajiFlow - Water refill, delivered.</p>
            <nav className="flex items-center gap-4" aria-label="Footer">
              <Link href="/" className="hover:underline">
                Home
              </Link>
              <Link href="/for-business" className="hover:underline">
                For businesses
              </Link>
              <Link href="/pricing" className="hover:underline">
                Pricing
              </Link>
              <Link href="/contact" className="hover:underline">
                Support
              </Link>
            </nav>
          </div>
        </footer>
      </div>

      <MobileTabBar
        items={[
          { href: "/account", label: "Overview", icon: LayoutDashboard },
          { href: "/account/orders", label: "Orders", icon: Package },
          { href: "/account/addresses", label: "Addresses", icon: MapPin },
          { href: "/browse", label: "Browse", icon: Droplets },
          { label: "More", icon: MoreHorizontal, onClick: () => setOpen(true) },
        ]}
      />
    </div>
  );
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
  badge,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  badge?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-white/8 text-[#0052FF]"
          : "text-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className={cn("size-4.5", active && "text-[#0052FF]")} aria-hidden />
      {label}
      {badge && (
        <span className="ml-auto flex min-w-5 items-center justify-center rounded-full bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground">
          {badge}
        </span>
      )}
    </Link>
  );
}
