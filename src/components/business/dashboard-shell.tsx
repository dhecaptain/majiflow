"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bell,
  Boxes,
  ChevronDown,
  CircleUser,
  CreditCard,
  LayoutDashboard,
  Lock,
  Megaphone,
  Menu,
  Package,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";
import { WaterDrawer } from "@/components/ui/water-drawer";
import { BusinessProvider, useBusiness } from "@/components/business/business-provider";
import { Badge } from "@/components/ui/badge";
import { businesses } from "@/lib/data/businesses";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string };

const NAV: NavItem[] = [
  { href: "/business", label: "Overview", icon: LayoutDashboard },
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

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <BusinessProvider>
      <DashboardShellInner>{children}</DashboardShellInner>
    </BusinessProvider>
  );
}

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { business, setBusinessId } = useBusiness();
  const [picker, setPicker] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const nav = (
    <nav aria-label="Dashboard" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
      {NAV.map((item) => (
        <SidebarLink key={item.href} href={item.href} label={item.label} icon={item.icon} active={pathname === item.href} onClick={() => setOpen(false)} />
      ))}
      <p className="px-3 pb-1 pt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Account</p>
      {LOWER.map((item) => (
        <SidebarLink key={item.href} href={item.href} label={item.label} icon={item.icon} active={pathname === item.href} badge={item.badge} onClick={() => setOpen(false)} />
      ))}
      <div className="mt-auto rounded-xl bg-[#0052FF]/5 p-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[#0052FF]">Trial</p>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#0052FF]/15">
          <div className="h-full w-[60%] rounded-full bg-brand-gradient" />
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
          <button
            type="button"
            onClick={() => setPicker((v) => !v)}
            onBlur={() => setTimeout(() => setPicker(false), 150)}
            className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-left transition-colors hover:border-[#0052FF]/40"
            aria-haspopup="listbox"
            aria-expanded={picker}
          >
            <span className="flex size-7 items-center justify-center rounded-lg bg-brand-gradient font-display text-xs text-white">
              {business.name.slice(0, 1)}
            </span>
            <span className="hidden text-sm font-semibold text-foreground sm:block">{business.name}</span>
            <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", picker && "rotate-180")} aria-hidden />
          </button>
          {picker && (
            <ul role="listbox" className="absolute left-0 top-[calc(100%+6px)] z-30 w-64 rounded-2xl border border-border bg-white p-1.5 shadow-layered">
              {businesses.map((b) => (
                <li key={b.slug}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={b.slug === business.slug}
                    onMouseDown={() => {
                      setBusinessId(b.id);
                      setPicker(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted",
                      b.slug === business.slug && "bg-[#0052FF]/5 text-[#0052FF]"
                    )}
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted font-display text-[10px] text-foreground">
                      {b.name.slice(0, 1)}
                    </span>
                    {b.name}
                  </button>
                </li>
              ))}
            </ul>
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
          <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-brand-gradient ring-2 ring-white" />
        </button>
        <button
          type="button"
          className="flex size-10 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-accent"
          aria-label="Your profile"
        >
          <span className="font-display text-sm">DK</span>
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
        <main className="p-4 sm:p-6">{children}</main>
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
        active ? "bg-[#0052FF]/8 text-[#0052FF]" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className={cn("size-4.5", active && "text-[#0052FF]")} aria-hidden />
      {label}
      {badge && (
        <span className="ml-auto rounded-full bg-warning-soft px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-warning">
          {badge}
        </span>
      )}
    </Link>
  );
}