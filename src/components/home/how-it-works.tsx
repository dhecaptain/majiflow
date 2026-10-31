import Link from "next/link";
import { MapPin, Store, PackagePlus, ShoppingCart, ClipboardList } from "lucide-react";
import { SectionScreen } from "@/components/ui/section-screen";
import { SectionHeading } from "@/components/ui/section-heading";
import { Button } from "@/components/ui/button";
import { AnimatedSection, Stagger, StaggerItem } from "@/components/ui/animated-section";

const steps = [
  {
    icon: MapPin,
    title: "Pick your city",
    text: "Choose your city and see the stations serving it.",
  },
  {
    icon: Store,
    title: "Compare stations",
    text: "Compare price, delivery fee and free-delivery minimum.",
  },
  {
    icon: PackagePlus,
    title: "Add to the cart",
    text: "One station per order, with its delivery fee shown up front.",
  },
  {
    icon: ShoppingCart,
    title: "Checkout and pay",
    text: "Pay with M-Pesa or card at checkout.",
  },
  {
    icon: ClipboardList,
    title: "Follow the order",
    text: "Track it from accepted to delivered.",
  },
];

export function HowItWorks() {
  return (
    <SectionScreen id="how-it-works" className="bg-surface-2">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div className="lg:self-center">
          <SectionHeading
            align="left"
            label="How it works"
            pulseLabel
            title={
              <>
                From browsing to <span className="text-gradient">delivered</span>
              </>
            }
            description="Order in a few steps, and follow every one."
          />
          <AnimatedSection delay={0.15} className="mt-8">
            <Link href="/browse">
              <Button size="lg" variant="secondary" className="group">
                Find your station
              </Button>
            </Link>
          </AnimatedSection>
        </div>

        <Stagger className="flex flex-col gap-4" stagger={0.09}>
          {steps.map((s, i) => (
            <StaggerItem key={s.title}>
              <div className="group flex gap-5 rounded-2xl border border-border bg-white p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-[var(--brand)]/25 hover:shadow-layered sm:p-6">
                <div className="relative flex flex-col items-center">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-transparent text-black shadow-accent transition-transform duration-300 group-hover:scale-110">
                    <s.icon className="size-5" aria-hidden />
                  </span>
                  <span className="mt-3 font-mono text-[11px] font-semibold uppercase tracking-widest text-[var(--brand)]">
                    Step {i + 1}
                  </span>
                  {i < steps.length - 1 && (
                    <span className="absolute -bottom-4 left-1/2 h-4 w-px -translate-x-1/2 bg-border sm:hidden" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </SectionScreen>
  );
}