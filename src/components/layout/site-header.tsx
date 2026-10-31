"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, MapPin, Pencil, Search, Store, Truck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/layout/brand-mark";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { NavMenu } from "@/components/layout/nav-menu";
import { LocationModal } from "@/components/order/location-modal";
import { StationsDrawer } from "@/components/order/stations-drawer";
import { useBrowseContext } from "@/components/order/browse-context";
import { useCustomer } from "@/components/order/customer-provider";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { browseHref } from "@/lib/journey";

function StationSearchOverlay({
  open,
  onClose,
  mounted,
}: {
  open: boolean;
  onClose: () => void;
  mounted: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const panelRef = useFocusTrap<HTMLElement>(open);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    router.push(browseHref("All cities", query));
    onClose();
  };

  if (!mounted) return null;

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close station search"
        onClick={onClose}
        tabIndex={open ? 0 : -1}
        className={`fixed inset-0 z-[120] h-full w-full rounded-none bg-black/50 p-0 transition-opacity hover:bg-black/50 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <section
        ref={panelRef}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label="Search stations"
        inert={!open}
        aria-hidden={!open}
        className={`fixed inset-x-0 top-0 z-[121] border-b border-border bg-white px-4 pb-6 pt-[calc(1rem+env(safe-area-inset-top))] shadow-xl transition-transform duration-200 motion-reduce:transition-none sm:px-6 sm:pb-8 ${open ? "translate-y-0" : "-translate-y-full"}`}
      >
        <div className="mx-auto max-w-3xl">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Find a station</h2>
              <p className="mt-1 text-sm text-muted-foreground">Search by station name or estate.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close station search"
              className="flex size-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <form onSubmit={submit} className="flex gap-2">
            <label className="flex min-w-0 flex-1 items-center gap-3 rounded-full border border-border bg-white px-4 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
              <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder="Try Kasarani"
                aria-label="Search stations by name or estate"
                data-autofocus
                className="h-12 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
            <button
              type="submit"
              className="h-12 shrink-0 rounded-full bg-foreground px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Search
            </button>
          </form>
        </div>
      </section>
    </>,
    document.body
  );
}

/** Keep the shared, original header everywhere except the browse route segment. */
export function SiteHeader() {
  const pathname = usePathname();
  if (pathname === "/browse" || pathname.startsWith("/browse/")) return null;
  if (pathname === "/") return <LandingSiteHeader />;
  return <OriginalSiteHeader />;
}

function LandingSiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-border bg-background/85 shadow-soft backdrop-blur-md"
          : "bg-transparent"
      )}
    >
      <div className="flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <BrandMark />
        <NavMenu />
      </div>
    </header>
  );
}

function OriginalSiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const pathname = usePathname();
  const { loggedIn } = useCustomer();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isHome = pathname === "/";

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 transition-all duration-200",
          scrolled || !isHome
            ? "border-b border-border bg-white/95 backdrop-blur-sm shadow-sm"
            : "bg-transparent"
        )}
      >
        <div className="mx-auto flex h-16 w-full max-w-[1100px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <BrandMark />
            <button
              type="button"
              onClick={() => setLocationOpen(true)}
              className="hidden items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-sm shadow-sm sm:flex"
            >
              <MapPin className="size-4 text-[var(--brand)]" aria-hidden />
              <span className="font-medium text-foreground">Delivery to</span>
              <span className="text-foreground/70">Select location</span>
              <ChevronDown className="size-4 text-foreground/70" aria-hidden />
            </button>
          </div>

          <Link href={loggedIn ? "/browse" : "/register"}>
            <Button
              className="min-h-10 rounded-full px-6 text-sm font-semibold"
              style={{ backgroundColor: "var(--brand)" }}
            >
              Get started
            </Button>
          </Link>
        </div>
      </header>
      <LocationModal open={locationOpen} onClose={() => setLocationOpen(false)} />
    </>
  );
}

export function BrowseSiteHeader() {
  const browse = useBrowseContext();
  const [locationOpen, setLocationOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [stationsOpen, setStationsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- the drawers use document portals */
    setMounted(true);
  }, []);

  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const openLocation = useCallback(() => {
    if (browse.canGoToStep("location")) browse.setCurrentStep("location");
    setLocationOpen(true);
  }, [browse]);

  const address = browse.location;
  const addressText = address
    ? [address.street, address.estate, address.city].filter(Boolean).join(", ") || address.label
    : "";
  const locationText = addressText || "Set your location";

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border bg-white pt-[env(safe-area-inset-top)]">
        <div className="flex h-16 w-full items-center gap-2 px-4 sm:gap-4 sm:px-6 lg:gap-6 lg:px-8 md:h-[90px]">
          <MobileMenu />
          <BrandMark compact className="shrink-0" />

          <button
            type="button"
            onClick={openLocation}
            aria-label={`Change location: ${locationText}`}
            className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-muted px-3 text-left transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:gap-3 sm:px-4 sm:py-1.5 lg:max-w-[520px]"
          >
            <Truck className="size-4 shrink-0 text-foreground" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="hidden text-[11px] leading-tight text-muted-foreground sm:block">
                Delivery to
              </span>
              <span className="block truncate text-xs font-bold leading-tight text-foreground sm:mt-0.5 sm:text-sm">
                {locationText}
              </span>
            </span>
            <Pencil className="hidden size-3.5 shrink-0 text-muted-foreground sm:block" aria-hidden />
          </button>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search stations"
              aria-haspopup="dialog"
              aria-expanded={searchOpen}
              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-white text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:size-11"
            >
              <Search className="size-[18px]" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setStationsOpen(true)}
              aria-label={browse.selectedStation ? `Stations, ${1} selected` : "Stations"}
              aria-haspopup="dialog"
              aria-expanded={stationsOpen}
              className="relative flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-white text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:size-11"
            >
              <Store className="size-[18px]" aria-hidden />
              {browse.selectedStation ? (
                <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold leading-5 text-white">
                  1
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </header>

      <LocationModal
        open={locationOpen}
        onClose={() => setLocationOpen(false)}
        onConfirm={() => {
          if (browse.currentStep === "location") browse.setCurrentStep("station");
        }}
      />
      <StationSearchOverlay open={searchOpen} onClose={closeSearch} mounted={mounted} />
      <StationsDrawer
        open={stationsOpen}
        onClose={() => setStationsOpen(false)}
        onSetLocation={openLocation}
        mounted={mounted}
      />
    </>
  );
}
