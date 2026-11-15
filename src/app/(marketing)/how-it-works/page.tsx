import Link from "next/link";
import { ArrowRight, Banknote, Droplet, MapPin, ReceiptText, Store } from "lucide-react";
import { PageHero, PageSection } from "@/components/shared/page-hero";
import { SectionHeading } from "@/components/ui/section-heading";

const steps = [
  { icon: MapPin, title: "Set your location", text: "Drop a pin on your door, or let your phone find you." },
  { icon: Store, title: "Pick a station", text: "Compare price, delivery fee, time and rating of stations that deliver to you." },
  { icon: Droplet, title: "Choose your water", text: "Refill your own can, buy a sealed bottle, or rent a dispenser." },
  { icon: Banknote, title: "Check out", text: "Delivery or pickup. Pay on delivery by cash or M-Pesa." },
  { icon: ReceiptText, title: "Follow your order", text: "See it go from accepted to on the way, with your rider's number." },
];

const answers = [
  { q: "Is anything actually delivered?", a: "Yes. Orders are accepted and delivered by the station you choose, and you can follow every stage." },
  { q: "Is there a free-delivery minimum?", a: "Each station sets its own. Some waive the delivery fee above an amount shown on the station page and in your cart." },
  { q: "Can I pay cash on delivery?", a: "Yes. Pay the rider by cash or M-Pesa when your water arrives, or pay at the counter when you collect." },
  { q: "What if something goes wrong?", a: "Open the order to see its status and call the station, or reach our support team from the contact page." },
];

const primary =
  "inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[var(--brand)] px-6 text-[15px] font-bold text-white transition-colors hover:bg-[var(--cta-hover)]";
const secondary =
  "inline-flex h-12 items-center justify-center rounded-lg border border-border bg-white px-6 text-[15px] font-bold text-foreground transition-colors hover:border-[var(--brand)]/40";

export const metadata = {
  title: "How it works",
  description:
    "Set your location, compare refill stations, pay on delivery and follow your order from checkout to your door.",
  alternates: { canonical: "/how-it-works" },
};

export default function HowItWorks() {
  return (
    <>
      <PageHero
        label="How it works"
        title="From your phone to your door in five steps"
        description="No account needed to order. You see every price and fee before you place it."
      >
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Link href="/browse" className={primary}>
            Find stations near you
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link href="/for-business" className={secondary}>
            Run a refill station?
          </Link>
        </div>
      </PageHero>

      <PageSection className="!pt-8 lg:!pt-12">
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-4 rounded-xl border border-border bg-white p-4 lg:flex-col lg:gap-3 lg:p-5">
              <span className="relative flex size-11 shrink-0 items-center justify-center rounded-md bg-brand-soft text-[var(--brand)]">
                <s.icon className="size-5" aria-hidden />
                <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-[var(--brand)] text-[11px] font-extrabold text-white">
                  {i + 1}
                </span>
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-base font-bold text-foreground">{s.title}</span>
                <span className="text-sm leading-relaxed text-muted-foreground">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </PageSection>

      <PageSection tinted>
        <SectionHeading label="Quick answers" title="Before you order" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {answers.map((f) => (
            <div key={f.q} className="rounded-xl border border-border bg-white p-5">
              <h3 className="text-base font-bold text-foreground">{f.q}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm text-muted-foreground">
          More in the{" "}
          <Link href="/faqs" className="font-semibold text-[var(--brand)] hover:underline">
            FAQs
          </Link>
          .
        </p>
      </PageSection>

      <PageSection>
        <div className="flex flex-col items-start gap-5 rounded-xl bg-[var(--brand)] p-6 text-white sm:flex-row sm:items-center sm:justify-between lg:p-9">
          <div className="flex flex-col gap-1.5">
            <h2 className="font-display text-2xl font-bold lg:text-[28px]">Ready when you are</h2>
            <p className="text-[15px] text-[#e1f1ff]">See which stations deliver to you and what they charge.</p>
          </div>
          <Link
            href="/browse"
            className="inline-flex h-12 shrink-0 items-center gap-2 rounded-lg bg-white px-6 text-[15px] font-bold text-[var(--brand)] transition-colors hover:bg-surface-2"
          >
            Order water
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </PageSection>
    </>
  );
}
