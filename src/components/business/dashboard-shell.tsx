"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  ClipboardCheck,
  CreditCard,
  LayoutDashboard,
  Menu,
  Package,
  Settings,
  Users,
  X,
} from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";
import { PageTransition } from "@/components/layout/page-transition";
import { BusinessProvider, useBusiness } from "@/components/business/business-provider";
import type { Business } from "@/lib/types";
import { getTrialProgress } from "@/lib/trial";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string };
type TrialSummary = {
  plan: string;
  status: "trialing" | "active" | "expired" | "cancelled";
  trialStartedAt: string | null;
  trialEndsAt: string | null;
};

const NAV: NavItem[] = [
  { href: "/business", label: "Overview", icon: LayoutDashboard },
  { href: "/business/applications", label: "Applications", icon: ClipboardCheck },
  { href: "/business/orders", label: "Orders", icon: Package },
  { href: "/business/products", label: "Products", icon: Boxes },
  { href: "/business/customers", label: "Customers", icon: Users },
  { href: "/business/analytics", label: "Analytics", icon: BarChart3 },
];

const LOWER: NavItem[] = [
  { href: "/business/billing", label: "Billing", icon: CreditCard },
  { href: "/business/settings", label: "Settings", icon: Settings, badge: "Plan" },
];

export function DashboardShell({
  children,
  stations = [],
}: {
  children: React.ReactNode;
  stations?: readonly Business[];
}) {
  return (
    <BusinessProvider stations={stations}>
      <DashboardShellInner>{children}</DashboardShellInner>
    </BusinessProvider>
  );
}

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { business, hasBusiness } = useBusiness();
  const [trialSummary, setTrialSummary] = useState<TrialSummary | null>(null);
  const [trialLoaded, setTrialLoaded] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!business.id) {
      return;
    }
    let cancelled = false;
    void fetch("/api/business/station", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? "Could not load trial details.");
        return body;
      })
      .then((body: { stations?: Array<{ business: { id: string }; subscription: TrialSummary | null }> }) => {
        if (cancelled) return;
        const station = body.stations?.find((item) => item.business.id === business.id);
        setTrialSummary(station?.subscription ?? null);
      })
      .catch(() => {
        if (!cancelled) setTrialSummary(null);
      })
      .finally(() => {
        if (!cancelled) setTrialLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [business.id]);

  const trialProgress =
    trialSummary?.status === "trialing"
      ? getTrialProgress(trialSummary.trialStartedAt, trialSummary.trialEndsAt, now)
      : null;

  const nav = (
    <nav aria-label="Dashboard" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
      {NAV.map((item) => (
        <SidebarLink key={item.href} href={item.href} label={item.label} icon={item.icon} active={pathname === item.href} onClick={() => setMobileNavOpen(false)} />
      ))}
      <p className="px-3 pb-1 pt-5 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Account</p>
      {LOWER.map((item) => (
        <SidebarLink key={item.href} href={item.href} label={item.label} icon={item.icon} active={pathname === item.href} badge={item.badge} onClick={() => setMobileNavOpen(false)} />
      ))}
      <div className="mt-auto rounded-xl bg-brand/5 p-3">
        <p className="font-mono text-[11px] uppercase tracking-widest text-[var(--brand)]">Trial</p>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-brand/15">
          <div
            className="h-full rounded-full bg-foreground"
            style={{ width: `${trialProgress?.percentUsed ?? 0}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] leading-snug text-foreground/70">
          {!trialLoaded ? (
            "Loading trial details…"
          ) : trialProgress ? (
            <>
              <strong className="text-foreground">
                {trialProgress.expired
                  ? "Trial ended"
                  : `${trialProgress.daysUsed} of 14 days used`}
              </strong>{" "}
              {trialProgress.expired
                ? "Choose a paid plan to continue."
                : `on the ${trialSummary?.plan ?? "selected"} plan.`}
            </>
          ) : (
            "Start your free trial from Station setup."
          )}
        </p>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-50 border-b border-border bg-white pt-[env(safe-area-inset-top)]">
        <div className="flex h-16 w-full items-center px-4 sm:px-6 lg:px-8 md:h-[90px]">
          <BrandMark href="/" compact className="shrink-0" />
          <button
            type="button"
            className="ml-3 inline-flex size-10 items-center justify-center rounded-xl border border-border text-foreground transition-colors hover:bg-muted lg:hidden"
            aria-label={mobileNavOpen ? "Close dashboard menu" : "Open dashboard menu"}
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            {mobileNavOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
          <span className="ml-auto text-sm font-semibold text-foreground">Business dashboard</span>
        </div>
      </header>
      {/* Desktop sidebar */}
      <aside className="fixed bottom-0 left-0 top-[calc(4rem+env(safe-area-inset-top))] z-40 hidden w-64 flex-col border-r border-border bg-white lg:top-[calc(90px+env(safe-area-inset-top))] lg:flex">
        {nav}
      </aside>
      {mobileNavOpen && (
        <>
          <button
            type="button"
            aria-label="Close dashboard menu"
            className="fixed inset-0 z-40 bg-foreground/30 lg:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="fixed bottom-0 left-0 top-[calc(4rem+env(safe-area-inset-top))] z-50 flex w-72 flex-col border-r border-border bg-white shadow-xl lg:hidden">
            {nav}
          </aside>
        </>
      )}

      <div className="min-h-[calc(100svh-4rem)] md:min-h-[calc(100svh-5.625rem)] lg:pl-64">
        <main id="main-content" tabIndex={-1} className="p-4 pb-10 outline-none sm:p-6 lg:pb-6">
          {trialProgress?.expired && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-foreground">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
              <div>
                <p className="font-semibold">Your free trial has ended</p>
                <p className="mt-1 text-muted-foreground">
                  Your station is hidden from customers until billing is activated. Your products and
                  settings are still saved.
                </p>
                <Link href="/business/billing" className="mt-2 inline-flex font-semibold text-[var(--brand)] hover:underline">
                  Open billing
                </Link>
              </div>
            </div>
          )}
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
        <span className="ml-auto rounded-full bg-warning-soft px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-warning">
          {badge}
        </span>
      )}
    </Link>
  );
}
