"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
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
  Package,
  Search,
  ShoppingCart,
} from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";
import { WaterDrawer } from "@/components/ui/water-drawer";
import { Button } from "@/components/ui/button";
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
  const [open, setOpen] = useState(false);
  const { count } = useCart();
  const { profile } = useCustomer();

  const name = profile.name || "";
  const initial = name ? name.trim().slice(0, 1).toUpperCase() : "U";

  const nav = (
    <nav aria-label="Account" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
      {NAV.map((item) => (
        <SidebarLink
          key={item.href}
          href={item.href}
          label={item.label}
          icon={item.icon}
          active={pathname === item.href}
          onClick={() => setOpen(false)}
        />
      ))}

      <p className="px-3 pb-1 pt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
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

      <p className="px-3 pb-1 pt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
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

      {/* Refill CTA */}
      <div className="mt-auto rounded-xl bg-brand-gradient p-3.5 text-white shadow-accent">
        <p className="font-display text-sm">Need a refill?</p>
        <p className="mt-0.5 text-[11px] leading-snug text-white/80">
          Stations near you deliver in under 60 minutes.
        </p>
        <Link
          href="/browse"
          onClick={() => setOpen(false)}
          className="mt-2.5 flex items-center justify-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold ring-1 ring-white/25 transition-colors hover:bg-white/25"
        >
          Order water
          <span aria-hidden>→</span>
        </Link>
      </div>

      {/* User card */}
      <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-border bg-white px-3 py-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-gradient font-display text-sm text-white">
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
          <Search className="size-4 text-muted-foreground" aria-hidden />
          <input
            className="w-44 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="Search orders, stations…"
            aria-label="Search your account"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/cart"
          aria-label={`Cart, ${count} items`}
          className="relative flex size-10 items-center justify-center rounded-xl border border-border bg-white text-muted-foreground hover:text-foreground"
        >
          <ShoppingCart className="size-4.5" aria-hidden />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-brand-gradient text-[11px] font-bold text-white shadow-accent ring-2 ring-white">
              {count}
            </span>
          )}
        </Link>
        <button
          type="button"
          className="relative flex size-10 items-center justify-center rounded-xl border border-border bg-white text-muted-foreground hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="size-4.5" aria-hidden />
          <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-brand-gradient ring-2 ring-white" />
        </button>
        <Link
          href="/account"
          aria-label="Your account"
          className="flex size-10 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-accent"
        >
          <span className="font-display text-sm">{initial}</span>
        </Link>
        <Link href="/browse" className="hidden sm:inline-flex">
          <Button className="group min-h-10">
            Order water
            <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">
              →
            </span>
          </Button>
        </Link>
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
      <div className="relative lg:pl-64">
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

        <main className="relative p-4 sm:p-6">{children}</main>

        <footer className="relative border-t border-border bg-white/60">
          <div className="mx-auto flex max-w-[80rem] flex-wrap items-center justify-between gap-4 px-4 py-3 text-xs text-muted-foreground sm:px-6">
            <p>MajiFlow — Water refill, delivered.</p>
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
          ? "bg-[#0052FF]/8 text-[#0052FF]"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className={cn("size-4.5", active && "text-[#0052FF]")} aria-hidden />
      {label}
      {badge && (
        <span className="ml-auto flex min-w-5 items-center justify-center rounded-full bg-brand-gradient px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}
