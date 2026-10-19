"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Bell,
  Boxes,
  CircleUser,
  ClipboardCheck,
  CreditCard,
  LayoutDashboard,
  Megaphone,
  Menu,
  MoreHorizontal,
  Package,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";
import { WaterDrawer } from "@/components/ui/water-drawer";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { PageTransition } from "@/components/layout/page-transition";
import { BusinessProvider, useBusiness } from "@/components/business/business-provider";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string };

const NAV: NavItem[] = [
  { href: "/business", label: "Overview", icon: LayoutDashboard },
  { href: "/business/applications", label: "Applications", icon: ClipboardCheck },
  { href: "/business/orders", label: "Orders", icon: Package },
  { href: "/business/products", label: "Products", icon: Boxes },
  { href: "/business/customers", label: "Customers", icon: Users },
  { href: "/business/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/business/promotions", label: "Promotions", icon: Megaphone },
  { href: "/business/staff", label: "Staff", icon: CircleUser },
];

const LOWER: NavItem[] = [
  { href: "/business/billing", label: "Billing", icon: CreditCard },
  { href: "/business/settings", label: "Settings", icon: Settings, badge: "Plan" },
];

export function DashboardShell({
  children,
  stationIds = [],
}: {
  children: React.ReactNode;
  stationIds?: readonly string[];
}) {
  return (
    <BusinessProvider approvedBusinessIds={stationIds}>
      <DashboardShellInner>{children}</DashboardShellInner>
    </BusinessProvider>
  );
}

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { business, hasBusiness } = useBusiness();
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = async () => {
    setLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Could not sign out.");
      router.replace("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  };

  const nav = (
    <nav aria-label="Dashboard" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
      {NAV.map((item) => (
        <SidebarLink key={item.href} href={item.href} label={item.label} icon={item.icon} active={pathname === item.href} onClick={() => setOpen(false)} />
      ))}
      <p className="px-3 pb-1 pt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Account</p>
      {LOWER.map((item) => (
        <SidebarLink key={item.href} href={item.href} label={item.label} icon={item.icon} active={pathname === item.href} badge={item.badge} onClick={() => setOpen(false)} />
      ))}
      <div className="mt-auto rounded-xl bg-transparent/5 p-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[#0052FF]">Trial</p>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-transparent/15">
          <div className="h-full w-[60%] rounded-full bg-foreground" />
        </div>
        <p className="mt-2 text-[11px] leading-snug text-foreground/70">
          <strong className="text-foreground">8 of 14 days</strong> used on the Growth plan.
        </p>
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
        <div className="relative">
          {hasBusiness ? (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-foreground font-display text-xs text-white">
                {business.name.slice(0, 1)}
              </span>
              <span className="hidden text-sm font-semibold text-foreground sm:block">{business.name}</span>
            </div>
          ) : (
            <Link
              href="/business/applications"
              className="rounded-xl border border-[#0052FF]/25 bg-[#0052FF]/5 px-3 py-2 text-sm font-semibold text-[#0052FF]"
            >
              Application pending
            </Link>
          )}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 md:flex">
          <Search className="size-4 text-muted-foreground" aria-hidden />
          <input
            className="w-44 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="Search orders, customers…"
            aria-label="Search dashboard"
          />
        </div>
        <button
          type="button"
          className="relative flex size-10 items-center justify-center rounded-xl border border-border bg-white text-muted-foreground hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="size-4.5" aria-hidden />
          <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-foreground ring-2 ring-white" />
        </button>
        <button
          type="button"
          onClick={logout}
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
        <div className="flex h-16 items-center border-b border-border px-5">
          <BrandMark className="scale-90" />
        </div>
        {nav}
      </aside>

      {/* Mobile drawer */}
      <WaterDrawer open={open} onClose={() => setOpen(false)}>
        {nav}
      </WaterDrawer>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-white/80 px-4 backdrop-blur-md sm:px-6">
          {header}
        </header>
        <main className="p-4 pb-24 sm:p-6 lg:pb-6">
          <PageTransition>          {hasBusiness || pathname === "/business/applications" ? children : <PendingBusinessState />}</PageTransition>
        </main>
      </div>

      <MobileTabBar
        items={[
          { href: "/business", label: "Overview", icon: LayoutDashboard },
          { href: "/business/orders", label: "Orders", icon: Package },
          { href: "/business/products", label: "Products", icon: Boxes },
          { href: "/business/customers", label: "Customers", icon: Users },
          { label: "More", icon: MoreHorizontal, onClick: () => setOpen(true) },
        ]}
      />
    </div>
  );
}

function PendingBusinessState() {
  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-white p-8 text-center shadow-card sm:p-12">
      <ClipboardCheck className="mx-auto size-10 text-[#0052FF]" aria-hidden />
      <h1 className="mt-5 font-display text-3xl text-foreground">Your application is being reviewed</h1>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
        Your dashboard will be enabled after your station is approved. Until then, you can track your
        application status without viewing or changing another station&apos;s data.
      </p>
      <Link
        href="/business/applications"
        className="mt-6 inline-flex rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-white"
      >
        View applications
      </Link>
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
        active ? "bg-transparent/8 text-[#0052FF]" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className={cn("size-4.5", active && "text-[#0052FF]")} aria-hidden />
      {label}
      {badge && (
        <span className="ml-auto rounded-full bg-transparent-soft px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-warning">
          {badge}
        </span>
      )}
    </Link>
  );
}