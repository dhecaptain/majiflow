"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, MapPin, Search, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/layout/brand-mark";
import { useOrderEntry } from "@/components/order/order-entry-provider";
import { useOrderSession } from "@/components/order/order-session-provider";
import { useCustomer } from "@/components/order/customer-provider";
import { useCart } from "@/components/order/cart-provider";
import { useCartUi } from "@/components/order/cart-ui-provider";
import { browseHref } from "@/lib/journey";
import type { DeliveryAddress } from "@/lib/types";

/**
 * Routes whose phone layout has its own top bar (a back button and a title,
 * or a full-bleed cover). The shared header only shows there from `lg` up.
 */
function ownsPhoneTopBar(pathname: string) {
  return (
    pathname.startsWith("/browse/") ||
    pathname === "/cart" ||
    pathname === "/checkout" ||
    pathname.startsWith("/order/") ||
    pathname.startsWith("/rider/")
  );
}

export function addressLabel(address: DeliveryAddress | null): string {
  if (!address) return "";
  return [address.street, address.estate, address.city].filter(Boolean).join(", ") || address.label;
}

/** The one customer header: delivery location, search and cart on every page. */
export function SiteHeader({ className }: { className?: string } = {}) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { openLocation } = useOrderEntry();
  const { address, fulfilment } = useOrderSession();
  const { loggedIn } = useCustomer();
  const [query, setQuery] = useState("");

  const location = addressLabel(address);
  const locationHint = fulfilment === "pickup" ? "Pick up near" : "Deliver to";
  const showPhoneSearch = pathname === "/";

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    router.push(browseHref("All cities", query.trim()));
  };

  const navLink = (href: string, label: string) => {
    const active = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold transition-colors hover:bg-muted",
          active ? "text-[var(--brand)]" : "text-foreground"
        )}
      >
        {label}
      </Link>
    );
  };

  return (
    <header
      data-site-header
      className={cn(
        "sticky top-0 z-50 border-b border-[#eef3fa] bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur-md",
        ownsPhoneTopBar(pathname) && "hidden lg:block",
        className
      )}
    >
      <div className="mx-auto flex w-full max-w-[1200px] items-center gap-3 px-4 py-3 sm:px-6 lg:gap-5 lg:py-3.5">
        <BrandMark compact className="hidden shrink-0 lg:inline-flex" />

        <button
          type="button"
          onClick={openLocation}
          aria-label={location ? `${locationHint} ${location}. Change location` : "Set your delivery location"}
          className="group flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left lg:max-w-[300px] lg:flex-none lg:rounded-full lg:border lg:border-border lg:bg-surface-2 lg:px-3.5 lg:hover:border-[var(--brand)]/40"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-soft text-[var(--brand)] lg:size-auto lg:bg-transparent">
            <MapPin className="size-5 lg:size-[18px]" aria-hidden />
          </span>
          <span className="flex min-w-0 flex-col lg:flex-row lg:items-center lg:gap-1.5">
            <span className="text-xs font-medium text-muted-foreground lg:hidden">{locationHint}</span>
            <span className="flex min-w-0 items-center gap-1 text-[15px] font-bold text-foreground lg:text-sm lg:font-semibold">
              <span className="truncate">{location || "Set your location"}</span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-y-0.5" aria-hidden />
            </span>
          </span>
        </button>

        <form role="search" onSubmit={submit} className="hidden min-w-0 flex-1 lg:flex">
          <SearchField value={query} onChange={setQuery} />
        </form>

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {navLink("/browse", "Stations")}
          {navLink("/account/orders", "Orders")}
          {loggedIn ? navLink("/account", "Account") : navLink("/login", "Sign in")}
        </nav>

        <HeaderCartButton />
      </div>

      {showPhoneSearch && (
        <form role="search" onSubmit={submit} className="px-4 pb-3 sm:px-6 lg:hidden">
          <SearchField value={query} onChange={setQuery} />
        </form>
      )}
    </header>
  );
}

function SearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex h-12 w-full items-center gap-2.5 rounded-lg border border-border bg-surface-2 px-4 text-muted-foreground transition-colors focus-within:border-[var(--brand)] focus-within:bg-white focus-within:ring-2 focus-within:ring-[var(--brand)]/15 lg:h-11 lg:rounded-full">
      <Search className="size-[18px] shrink-0" aria-hidden />
      <span className="sr-only">Search stations or estates</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder="Search stations or estates"
        className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground lg:text-sm"
      />
    </label>
  );
}

/** Cart button with a live item count: opens the cart drawer, or goes to the cart page from checkout. */
function HeaderCartButton() {
  const { items, hydrated } = useCart();
  const { openCart } = useCartUi();
  const pathname = usePathname();
  const count = hydrated ? items.reduce((n, item) => n + item.quantity, 0) : 0;
  const label = count > 0 ? `Cart, ${count} ${count === 1 ? "item" : "items"}` : "Cart";
  const className =
    "relative flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-white text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] lg:w-auto lg:gap-2 lg:rounded-full lg:border-transparent lg:bg-[var(--brand)] lg:px-4 lg:text-sm lg:font-bold lg:text-white lg:hover:bg-[var(--cta-hover)]";
  const badge =
    count > 0 ? (
      <span className="absolute -right-1.5 -top-1.5 flex min-w-5 items-center justify-center rounded-full border-2 border-white bg-[var(--coral-cta)] px-1 text-[11px] font-bold leading-4 text-white lg:static lg:border-0 lg:bg-white/20 lg:leading-5">
        {count > 99 ? "99+" : count}
      </span>
    ) : null;
  const content = (
    <>
      <ShoppingBag className="size-5 lg:size-[18px]" aria-hidden />
      <span className="hidden lg:inline">Cart</span>
      {badge}
    </>
  );

  // On the cart/checkout pages the drawer would only duplicate the page.
  if (pathname === "/cart" || pathname === "/checkout") {
    return (
      <Link href="/cart" aria-label={label} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={openCart} aria-label={label} className={className}>
      {content}
    </button>
  );
}
