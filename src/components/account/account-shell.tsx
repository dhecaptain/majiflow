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
import { PageTransition } from "@/components/layout/page-transition";
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

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/account" && pathname.startsWith(`${href}/`));
}

export function AccountShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/account";
  const { count } = useCart();
  const { profile } = useCustomer();

  const name = profile.name || "";
  const initial = name ? name.trim().slice(0, 1).toUpperCase() : "U";

  return (
    <div className="flex min-h-screen flex-col bg-surface-2">
      <SiteHeader />

      <div className="mx-auto flex w-full max-w-[1200px] flex-1 gap-8 lg:px-6 lg:py-8">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <nav
            aria-label="Account"
            className="sticky top-[calc(5.5rem+env(safe-area-inset-top))] flex flex-col gap-1 rounded-xl border border-border bg-white p-3"
          >
            <div className="mb-2 flex items-center gap-2.5 border-b border-[#eef3fa] px-2 pb-3 pt-1">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-extrabold text-white">
                {initial}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">{name || "Guest"}</p>
                <p className="truncate text-xs text-muted-foreground">{profile.phone || "Sign in to sync orders"}</p>
              </div>
            </div>

            {NAV.map((item) => (
              <SidebarLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={isActive(pathname, item.href)}
              />
            ))}

            <p className="px-3 pb-1 pt-4 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Shop</p>
            {SHOP.map((item) => (
              <SidebarLink key={item.href} href={item.href} label={item.label} icon={item.icon} active={pathname === item.href} />
            ))}
            <SidebarLink
              href="/cart"
              label="Cart"
              icon={ShoppingCart}
              active={pathname === "/cart"}
              badge={count > 0 ? String(count) : undefined}
            />

            <p className="px-3 pb-1 pt-4 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Help</p>
            {HELP.map((item) => (
              <SidebarLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
            ))}
          </nav>
        </aside>

        {/* Content column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Phone: account sections as scrollable pills */}
          <nav
            aria-label="Account"
            className="-mb-1 flex gap-2 overflow-x-auto px-4 pt-4 [scrollbar-width:none] sm:px-6 lg:hidden [&::-webkit-scrollbar]:hidden"
          >
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]",
                    active
                      ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                      : "border-border bg-white text-foreground hover:bg-brand-soft"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
            <PageTransition>{children}</PageTransition>
          </main>

          {/* The site footer is marketing-only, so the signed-in shell carries its own short one (desktop). */}
          <footer className="mt-8 hidden border-t border-border lg:block">
            <div className="flex flex-wrap items-center justify-between gap-4 py-4 text-xs text-muted-foreground">
              <p>MajiFlow - Water refill, delivered.</p>
              <nav className="flex items-center gap-4" aria-label="Footer">
                <Link href="/" className="hover:text-foreground hover:underline">
                  Home
                </Link>
                <Link href="/for-business" className="hover:text-foreground hover:underline">
                  For businesses
                </Link>
                <Link href="/pricing" className="hover:text-foreground hover:underline">
                  Pricing
                </Link>
                <Link href="/contact" className="hover:text-foreground hover:underline">
                  Support
                </Link>
              </nav>
            </div>
          </footer>
        </div>
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
        "flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--brand)]",
        active
          ? "bg-brand-soft font-bold text-brand-deep"
          : "font-semibold text-foreground hover:bg-surface-2"
      )}
    >
      <Icon className={cn("size-[18px]", active ? "text-brand-deep" : "text-muted-foreground")} aria-hidden />
      {label}
      {badge && (
        <span className="ml-auto flex min-w-5 items-center justify-center rounded-full bg-[var(--brand)] px-1.5 py-0.5 text-[11px] font-bold text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}
