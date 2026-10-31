"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CreditCard,
  Droplets,
  Headphones,
  LayoutDashboard,
  MapPin,
  MessageCircle,
  Package,
  ShoppingCart,
  User,
} from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { BlurImage } from "@/components/ui/blur-image";
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
          active={pathname === item.href || (item.href !== "/account" && pathname.startsWith(`${item.href}/`))}
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
        />
      ))}
      <SidebarLink
        href="/cart"
        label="Cart"
        icon={ShoppingCart}
        active={pathname === "/cart"}
        badge={count > 0 ? String(count) : undefined}
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

  return (
    <div className="min-h-screen bg-muted/40">
      <SiteHeader />
      {/* Desktop sidebar */}
      <aside className="fixed bottom-0 left-0 top-[calc(4rem+env(safe-area-inset-top))] z-40 hidden w-64 flex-col border-r border-border bg-white lg:top-[calc(90px+env(safe-area-inset-top))] lg:flex">
        {nav}
      </aside>

      {/* Content column */}
      <div className="relative flex min-h-[calc(100svh-4rem)] flex-col md:min-h-[calc(100svh-5.625rem)] lg:pl-64">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-y-0 left-0 right-0 z-0 lg:left-64"
        >
          <BlurImage
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

        <main className="relative flex-1 p-4 pb-10 sm:p-6 lg:pb-6">
          <PageTransition>{children}</PageTransition>
        </main>

        <footer className="relative border-t border-border bg-white/60">
          <div className="mx-auto flex max-w-[80rem] flex-wrap items-center justify-between gap-4 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 text-xs text-foreground sm:px-6 lg:pb-3">
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
        "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-cta-soft text-[var(--brand)]"
          : "text-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className={cn("size-4.5", active && "text-[var(--brand)]")} aria-hidden />
      {label}
      {badge && (
        <span className="ml-auto flex min-w-5 items-center justify-center rounded-full bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground">
          {badge}
        </span>
      )}
    </Link>
  );
}
