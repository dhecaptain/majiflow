import Link from "next/link";
import { ArrowRight } from "lucide-react";

const STEPS = [
  {
    title: "Set your location",
    body: "See the stations that deliver to your door, with their real prices.",
  },
  {
    title: "Pick your water",
    body: "Refill your own can, buy a sealed bottle, or rent a dispenser.",
  },
  {
    title: "Pay when it arrives",
    body: "Follow your order, then pay the rider in cash or M-Pesa at the door.",
  },
];

/** Three plain steps: what ordering on MajiFlow involves. */
export function HowItWorks() {
  return (
    <section aria-labelledby="how-title" className="mx-auto w-full max-w-[1200px] px-4 pt-10 sm:px-6 lg:pt-16">
      <h2 id="how-title" className="text-lg font-extrabold tracking-tight text-foreground lg:text-2xl">
        How it works
      </h2>
      <ol className="mt-3 grid gap-3 sm:grid-cols-3 lg:mt-4 lg:gap-4">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-3.5 rounded-xl bg-surface-2 p-4 sm:flex-col sm:gap-2 lg:p-6">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-sm font-extrabold text-white">
              {index + 1}
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-base font-bold text-foreground">{step.title}</span>
              <span className="text-sm leading-relaxed text-muted-foreground">{step.body}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Invitation for station owners, kept at the end of the home page. */
export function VendorBanner() {
  return (
    <section className="mx-auto w-full max-w-[1200px] px-4 pb-10 pt-10 sm:px-6 lg:pb-16 lg:pt-16">
      <div className="flex flex-col items-start gap-5 rounded-xl bg-foreground p-6 text-white sm:flex-row sm:items-center sm:justify-between lg:rounded-2xl lg:p-9">
        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-2xl font-bold lg:text-[28px]">Run a refill station?</h2>
          <p className="text-[15px] text-[#cbe7ff] lg:text-base">
            List it on MajiFlow and take orders from customers nearby.
          </p>
        </div>
        <Link
          href="/for-business"
          className="inline-flex h-12 shrink-0 items-center gap-2 rounded-lg bg-white px-6 text-[15px] font-bold text-foreground transition-colors hover:bg-surface-2"
        >
          List your station
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
