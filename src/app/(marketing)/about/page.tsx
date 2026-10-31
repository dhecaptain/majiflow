import { HeartHandshake, Repeat, ShieldCheck, Users } from "lucide-react";
import { PageHero } from "@/components/shared/page-hero";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Stagger, StaggerItem } from "@/components/ui/animated-section";

const values = [
  {
    icon: ShieldCheck,
    title: "Verified stations",
    text: "Every station is verified before it is listed.",
  },
  {
    icon: Repeat,
    title: "Built around Kenyan stations",
    text: "Stations across five cities, each with its own prices and hours.",
  },
  {
    icon: Users,
    title: "Support when you need it",
    text: "Our team helps customers and stations with orders and payments.",
  },
  {
    icon: HeartHandshake,
    title: "Simple, fair pricing",
    text: "A flat monthly fee with no commission, and a 14-day free trial.",
  },
];

const timeline = [
  {
    marker: "01",
    title: "The storefront",
    text: "Stations list products, prices and delivery fees, and customers order from them.",
  },
  {
    marker: "02",
    title: "Every order",
    text: "Orders are stored and move from pending to delivered, with each change recorded.",
  },
  {
    marker: "03",
    title: "What comes next",
    text: "Recurring refills, loyalty tools and multi-branch support are on the roadmap.",
  },
];

export const metadata = {
  title: "About us",
  description:
    "MajiFlow connects homes to independent water refill stations across Kenya and gives those businesses the tools to grow.",
};

export default function About() {
  return (
    <>
      <PageHero
        label="About us"
        title={
          <>
            The best water company is{" "}
            <span className="text-gradient">already in town</span>
          </>
        }
        description="The software a water refill business runs its shop on."
      />

      <section className="py-16 lg:py-20">
        <Container>
          <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <SectionHeading align="left" label="Why we exist" title="Local water, better tools." />
              <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">
                We build what a refill station needs: a page for products and prices, a cart that
                shows the delivery fee of that station, and a dashboard for orders and analytics.
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
                MajiFlow connects customers with independent stations across Kenya, so the water you
                drink is filtered close to home.
              </p>
            </div>
            <Stagger className="grid gap-4 sm:grid-cols-2" stagger={0.07}>
              {values.map((v) => (
                <StaggerItem key={v.title}>
                  <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-card">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-cta-soft text-[var(--brand)]">
                      <v.icon className="size-5" aria-hidden />
                    </span>
                    <h3 className="mt-4 font-semibold text-foreground">{v.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{v.text}</p>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </Container>
      </section>

      <section className="bg-card py-16 lg:py-20">
        <Container>
          <SectionHeading
            label="How it is put together"
            title={
              <>
                A storefront, orders, and <span className="text-gradient">the road ahead</span>
              </>
            }
          />
          <Stagger className="mx-auto mt-12 max-w-2xl" stagger={0.1}>
            {timeline.map((t) => (
              <StaggerItem key={t.marker}>
                <div className="relative flex gap-6 pb-14 last:pb-0">
                  <div className="flex flex-col items-center">
                    <span className="z-10 flex size-10 shrink-0 items-center justify-center rounded-full bg-cta-soft font-mono text-[11px] font-bold text-[var(--brand)]">
                      {t.marker}
                    </span>
                    {t !== timeline[timeline.length - 1] && (
                      <span className="mt-1 w-px flex-1 bg-gradient-to-b from-[var(--brand)]/40 to-transparent" />
                    )}
                  </div>
                  <div className="rounded-2xl border border-border bg-background p-5 shadow-card">
                    <p className="font-mono text-[11px] uppercase tracking-widest text-[var(--brand)]">{t.title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-foreground/85">{t.text}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </Container>
      </section>

      <section className="py-16 lg:py-20">
        <Container size="md">
          <div className="rounded-3xl border border-[var(--brand)]/20 bg-card p-8 text-center shadow-card sm:p-12">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              What we stand for
            </p>
            <p className="mx-auto mt-4 max-w-xl font-display text-2xl leading-snug text-foreground sm:text-3xl">
              Clean water should be close to home, and the businesses that deliver it should have the
              tools to grow.
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}
