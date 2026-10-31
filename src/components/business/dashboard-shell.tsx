"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  CircleUser,
  ClipboardCheck,
  CreditCard,
  LayoutDashboard,
  Megaphone,
  Package,
  Settings,
  Users,
} from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";
import { SiteHeader } from "@/components/layout/site-header";
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
  const { hasBusiness } = useBusiness();

  const nav = (
    <nav aria-label="Dashboard" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
      {NAV.map((item) => (
        <SidebarLink key={item.href} href={item.href} label={item.label} icon={item.icon} active={pathname === item.href} />
      ))}
      <p className="px-3 pb-1 pt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Account</p>
      {LOWER.map((item) => (
        <SidebarLink key={item.href} href={item.href} label={item.label} icon={item.icon} active={pathname === item.href} badge={item.badge} />
      ))}
      <div className="mt-auto rounded-xl bg-brand/5 p-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--brand)]">Trial</p>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-brand/15">
          <div className="h-full w-[60%] rounded-full bg-foreground" />
        </div>
        <p className="mt-2 text-[11px] leading-snug text-foreground/70">
          <strong className="text-foreground">8 of 14 days</strong> used on the Growth plan.
        </p>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-muted/40">
      <SiteHeader />
      {/* Desktop sidebar */}
      <aside className="fixed bottom-0 left-0 top-[calc(4rem+env(safe-area-inset-top))] z-40 hidden w-64 flex-col border-r border-border bg-white lg:top-[calc(90px+env(safe-area-inset-top))] lg:flex">
        <div className="flex h-16 items-center border-b border-border px-5">
          <BrandMark className="scale-90" />
        </div>
        {nav}
      </aside>

      <div className="min-h-[calc(100svh-4rem)] md:min-h-[calc(100svh-5.625rem)] lg:pl-64">
        <main className="p-4 pb-10 sm:p-6 lg:pb-6">
          <PageTransition>{hasBusiness || pathname === "/business/applications" ? children : <PendingBusinessState />}</PageTransition>
        </main>
      </div>
    </div>
  );
}

function PendingBusinessState() {
  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-white p-8 text-center shadow-card sm:p-12">
      <ClipboardCheck className="mx-auto size-10 text-[var(--brand)]" aria-hidden />
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
        active ? "bg-brand/10 text-[var(--brand)]" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className={cn("size-4.5", active && "text-[var(--brand)]")} aria-hidden />
      {label}
      {badge && (
        <span className="ml-auto rounded-full bg-warning-soft px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-warning">
          {badge}
        </span>
      )}
    </Link>
  );
}
