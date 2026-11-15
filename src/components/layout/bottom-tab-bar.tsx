"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Droplet, House, ReceiptText, UserRound, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
}

const TABS: Tab[] = [
  { href: "/", label: "Home", icon: House, match: (p) => p === "/" },
  { href: "/browse", label: "Stations", icon: Droplet, match: (p) => p === "/browse" },
  { href: "/account/orders", label: "Orders", icon: ReceiptText, match: (p) => p.startsWith("/account/orders") },
  {
    href: "/account",
    label: "Account",
    icon: UserRound,
    match: (p) => (p.startsWith("/account") && !p.startsWith("/account/orders")) || p === "/login" || p === "/register",
  },
];

/** Customer pages that keep the tab bar. Ordering steps own the bottom of the screen instead. */
const CONTENT_PAGES = new Set(["/about", "/how-it-works", "/faqs", "/contact", "/privacy", "/terms", "/for-business", "/pricing"]);

export function showsTabBar(pathname: string): boolean {
  return pathname === "/" || pathname === "/browse" || pathname.startsWith("/account") || CONTENT_PAGES.has(pathname);
}

/**
 * Phone navigation: Home, Stations, Orders, Account. Hidden from `lg` up,
 * where the header carries the same links. While it shows, it raises
 * `--tabbar-h` so floating bars and toasts sit above it.
 */
export function BottomTabBar() {
  const pathname = usePathname() ?? "/";
  const visible = showsTabBar(pathname);

  useEffect(() => {
    const root = document.documentElement;
    if (visible) root.setAttribute("data-tabbar", "");
    else root.removeAttribute("data-tabbar");
    return () => root.removeAttribute("data-tabbar");
  }, [visible]);

  if (!visible) return null;

  return (
    <>
      <div aria-hidden className="h-[calc(4.25rem+env(safe-area-inset-bottom))] lg:hidden" />
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-[45] grid grid-cols-4 border-t border-border bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur-md lg:hidden"
      >
        {TABS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-14 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--brand)]",
                active ? "font-bold text-[var(--brand)]" : "font-semibold text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 2} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
