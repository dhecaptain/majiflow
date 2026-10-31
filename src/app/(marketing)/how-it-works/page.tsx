import { PageHero } from "@/components/shared/page-hero";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Button } from "@/components/ui/button";
import { Stagger, StaggerItem } from "@/components/ui/animated-section";
import { MapPin, Store, PackagePlus, ShoppingCart, ClipboardList, Bell } from "lucide-react";
import Link from "next/link";

const customerSteps = [
  {
    icon: MapPin,
    title: "Choose your city",
    text: "Pick your city and see the stations there.",
  },
  {
    icon: Store,
    title: "Compare stations",
    text: "Compare price, delivery fee and free-delivery minimum.",
  },
  {
    icon: PackagePlus,
    title: "Build your cart",
    text: "Cans, bottles and dispensers from one station, with its delivery fee shown up front.",
  },
  {
    icon: ShoppingCart,
    title: "Checkout and pay",
    text: "Pay with M-Pesa or card and get a confirmation.",
  },
  {
    icon: ClipboardList,
    title: "Follow the order",
    text: "Track it from pending to delivered.",
  },
  {
    icon: Bell,
    title: "Recurring orders, coming soon",
    text: "A refill schedule with reminders is on the roadmap.",
  },
];

const faqItems = [
  { q: "Is anything actually delivered?", a: "Yes. Orders are accepted and delivered by the station you choose, and you can follow every stage." },
  { q: "Is there a free-delivery minimum?", a: "Yes, each station sets its own. Some waive the delivery fee above a set amount, shown on the station page and in your cart." },
  { q: "What if something goes wrong?", a: "Open the order to see its status and contact the station, or reach support from the contact page." },
  { q: "Can I pay cash on delivery?", a: "Orders are prepaid by M-Pesa or card at checkout." },
];

export const metadata = {
  title: "How it works",
  description:
    "Compare refill stations, build a cart, pay with M-Pesa and follow your delivery from checkout to your door.",
};

export default function HowItWorks() {
  return (
    <>
      <PageHero
        label="How it works"
        pulseLabel
        title={
          <>
            From browsing to a <span className="text-gradient">delivered order</span>
          </>
        }
        description="Compare stations, place an order and follow it to your door."
      >
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Link href="/browse">
            <Button size="lg" variant="secondary" className="group w-full sm:w-auto">
              Browse stations
            </Button>
          </Link>
          <Link href="/business">
            <Button size="lg" variant="secondary" className="w-full sm:w-auto">
              Open the dashboard
            </Button>
          </Link>
        </div>
      </PageHero>

      <section className="py-16 lg:py-20">
        <Container>
          <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" stagger={0.07}>
            {customerSteps.map((s, i) => (
              <StaggerItem key={s.title}>
                <div className="group flex h-full flex-col rounded-2xl border border-border bg-card p-7 shadow-card">
                  <div className="flex items-center justify-between">
                    <span className="flex size-12 items-center justify-center rounded-xl bg-cta-soft text-[var(--brand)]">
                      <s.icon className="size-5" aria-hidden />
                    </span>
                    <span className="font-mono text-sm font-bold text-[var(--brand)]/40">0{i + 1}</span>
                  </div>
                  <h3 className="mt-6 font-display text-xl text-foreground">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground">{s.text}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </Container>
      </section>

      <section className="bg-card py-16 lg:py-20">
        <Container size="md">
          <SectionHeading
            label="Quick answers"
            title={
              <>
                Common <span className="text-gradient">questions</span>
              </>
            }
          />
          <Stagger className="mt-12 grid gap-5 sm:grid-cols-2" stagger={0.07}>
            {faqItems.map((f) => (
              <StaggerItem key={f.q}>
                <div className="h-full rounded-2xl border border-border bg-background p-6 shadow-card">
                  <h3 className="flex items-start gap-2.5 font-semibold text-foreground">
                    <Store className="mt-0.5 size-5 shrink-0 text-[var(--brand)]" aria-hidden />
                    {f.q}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-foreground">{f.a}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </Container>
      </section>
    </>
  );
}
