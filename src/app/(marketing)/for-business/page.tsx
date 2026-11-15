import Link from "next/link";
import { ArrowRight, BarChart3, Coins, Megaphone, PackagePlus, Store, Users } from "lucide-react";
import { PageHero, PageSection } from "@/components/shared/page-hero";
import { SectionHeading } from "@/components/ui/section-heading";
import { listStations } from "@/lib/server/catalog";

const pillars = [
  { icon: Store, title: "A storefront for your station", text: "Your products, prices and delivery fees on one page customers can order from." },
  { icon: PackagePlus, title: "Change the menu any time", text: "Update prices and stock from the dashboard and your page follows." },
  { icon: Coins, title: "Paid on delivery, straight to you", text: "Customers pay your rider or counter by cash or M-Pesa, recorded against each order." },
  { icon: BarChart3, title: "Numbers from your own orders", text: "Sales, top products and stock alerts, built from the orders you actually took." },
  { icon: Users, title: "Know your customers", text: "Order history per customer, and status updates sent as you move each order along." },
  { icon: Megaphone, title: "Bring customers back", text: "Promotions for repeat or quiet customers, with the results tracked." },
];

const steps = [
  { t: "Create your profile", d: "Business name, location and a delivery fee." },
  { t: "List your products", d: "Cans, bottles, dispensers and prices in KES." },
  { t: "Set delivery zones", d: "Choose estates and a free-delivery minimum." },
  { t: "Go live", d: "Once verified, your station starts taking orders." },
];

/** Live platform numbers. A count that is still zero is left out rather than shown. */
async function platformNumbers() {
  const stations = await listStations().catch(() => []);
  const counts = [
    { count: stations.length, label: "stations live" },
    { count: stations.reduce((total, b) => total + b.products.length, 0), label: "products listed" },
    { count: new Set(stations.map((b) => b.city)).size, label: "cities covered" },
  ];
  return [
    ...counts.filter(({ count }) => count > 0).map(({ count, label }) => ({ value: `${count}`, label })),
    { value: "14", label: "day free trial" },
    { value: "0%", label: "commission on orders" },
  ];
}

const primary =
  "inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[var(--brand)] px-6 text-[15px] font-bold text-white transition-colors hover:bg-[var(--cta-hover)]";
const secondary =
  "inline-flex h-12 items-center justify-center rounded-lg border border-border bg-white px-6 text-[15px] font-bold text-foreground transition-colors hover:border-[var(--brand)]/40";

export const metadata = {
  title: "For businesses",
  description:
    "A storefront, a dashboard and simple monthly pricing for water refill businesses. Start with a 14-day free trial.",
  alternates: { canonical: "/for-business" },
};

export default async function ForBusiness() {
  const numbers = await platformNumbers();
  return (
    <>
      <PageHero
        label="For refill stations"
        title="Your station, your prices. Our storefront."
        description="Take orders from customers nearby, with a dashboard for every order and a flat monthly fee."
        aside={
          <dl className="grid grid-cols-2 gap-3">
            {numbers.slice(0, 4).map((n) => (
              <div key={n.label} className="rounded-xl border border-border bg-white p-4">
                <dd className="text-[28px] font-extrabold leading-none tracking-tight text-foreground">{n.value}</dd>
                <dt className="mt-1.5 text-[13px] text-muted-foreground">{n.label}</dt>
              </div>
            ))}
          </dl>
        }
      >
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Link href="/business/register" className={primary}>
            Create your station
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link href="/pricing" className={secondary}>
            See pricing
          </Link>
        </div>
      </PageHero>

      <PageSection>
        <SectionHeading
          label="What you get"
          title="Everything between your station and a regular customer"
          description="Every figure in the dashboard comes from the orders your station has actually taken."
        />
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((p) => (
            <li key={p.title} className="flex gap-4 rounded-xl border border-border bg-white p-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-brand-soft text-[var(--brand)]">
                <p.icon className="size-5" aria-hidden />
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-base font-bold text-foreground">{p.title}</span>
                <span className="text-sm leading-relaxed text-muted-foreground">{p.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </PageSection>

      <PageSection tinted>
        <SectionHeading label="Getting started" title="Set up in four steps" />
        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.t} className="flex flex-col gap-2 rounded-xl border border-border bg-white p-5">
              <span className="flex size-9 items-center justify-center rounded-full bg-[var(--brand)] text-sm font-extrabold text-white">
                {i + 1}
              </span>
              <span className="text-base font-bold text-foreground">{s.t}</span>
              <span className="text-sm leading-relaxed text-muted-foreground">{s.d}</span>
            </li>
          ))}
        </ol>
      </PageSection>

      <PageSection>
        <div className="flex flex-col items-start gap-5 rounded-xl bg-foreground p-6 text-white sm:flex-row sm:items-center sm:justify-between lg:p-9">
          <div className="flex flex-col gap-1.5">
            <h2 className="font-display text-2xl font-bold lg:text-[28px]">Start with 14 days free</h2>
            <p className="text-[15px] text-[#cbe7ff]">No commission, no setup fee. Cancel any time.</p>
          </div>
          <Link
            href="/business/register"
            className="inline-flex h-12 shrink-0 items-center gap-2 rounded-lg bg-white px-6 text-[15px] font-bold text-foreground transition-colors hover:bg-surface-2"
          >
            Create your station
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </PageSection>
    </>
  );
}
