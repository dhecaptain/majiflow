"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { PageTransition } from "@/components/layout/page-transition";
import { useSignOut } from "@/components/layout/customer-sidebar";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/account", label: "Overview" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/notifications", label: "Notifications" },
  { href: "/account/profile", label: "Profile" },
  { href: "/account/addresses", label: "Addresses" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/account" && pathname.startsWith(`${href}/`));
}

/**
 * Signed-in customer area. On desktop the shared CustomerSidebar (rendered by
 * the root layout) carries the navigation and replaces the site header, so
 * moving to stations or the cart keeps the same layout. Phones keep the site
 * header, these section pills and the tab bar.
 */
export function AccountShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/account";
  const { signOut, pending } = useSignOut();

  return (
    <div className="flex min-h-screen flex-col bg-surface-2">
      <SiteHeader />

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
        <div className="mx-auto w-full max-w-[1080px] lg:px-10 lg:pb-10 lg:pt-9">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>

      {/* Phone: the sidebar's sign-out lives at the end of every account page. */}
      <div className="px-4 pb-8 pt-2 sm:px-6 lg:hidden">
        <button
          type="button"
          onClick={signOut}
          disabled={pending}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-border bg-white text-sm font-bold text-danger transition-colors hover:bg-danger-soft disabled:opacity-50"
        >
          <LogOut className="size-4" aria-hidden />
          {pending ? "Signing out…" : "Sign out"}
        </button>
      </div>

      <footer className="hidden border-t border-[#e6eef8] lg:block">
        <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-4 px-10 py-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} MajiFlow · Water refill, delivered.</p>
          <nav className="flex items-center gap-4" aria-label="Footer">
            <Link href="/" className="hover:text-foreground hover:underline">
              Home
            </Link>
            <Link href="/privacy" className="hover:text-foreground hover:underline">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground hover:underline">
              Terms
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
