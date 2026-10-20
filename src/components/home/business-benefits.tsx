import Link from "next/link";
import { BarChart3, MessageSquare, Store, Users } from "lucide-react";
import { SectionScreen } from "@/components/ui/section-screen";
import { SectionHeading } from "@/components/ui/section-heading";
import { Button } from "@/components/ui/button";
import { Stagger, StaggerItem, AnimatedSection } from "@/components/ui/animated-section";

const benefits = [
  {
    icon: BarChart3,
    title: "A storefront for your station",
    text: "Your products, prices and delivery fees on one page.",
  },
  {
    icon: MessageSquare,
    title: "Orders you accept and track",
    text: "Accept or reject orders and move them to delivered.",
  },
  {
    icon: BarChart3,
    title: "Reports from your own orders",
    text: "Sales, top products and stock alerts from your real orders.",
  },
  {
    icon: Users,
    title: "Team, customers and stock",
    text: "Staff, customer history and low-stock alerts together.",
  },
];

export function BusinessBenefits() {
  return (
    <SectionScreen id="for-business" className="bg-white">
      <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
        <div className="order-2 lg:order-1">
          <Stagger className="grid gap-4 sm:grid-cols-2">
            {benefits.map((b) => (
              <StaggerItem key={b.title}>
                <div className="group flex h-full flex-col rounded-2xl border border-border bg-background p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[#0052FF]/25 hover:bg-white hover:shadow-layered">
                  <span className="flex size-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110">
                    <b.icon className="size-5 text-black" aria-hidden />
                  </span>
                  <h3 className="mt-5 text-base font-bold text-foreground">{b.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.text}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        {/* clip (not hidden) keeps the vertical axis intact while containing
            the horizontal reveal offset, which would otherwise widen the page
            on narrow viewports. An element cannot clip its own transform, so
            this has to sit on the parent column. */}
        <div className="order-1 overflow-x-clip lg:order-2">
          <SectionHeading
            align="left"
            label="For businesses"
            title={
              <>
                Run the station from <span className="text-gradient">one dashboard</span>
              </>
            }
            description="Everything a refill station needs to sell and deliver water online."
          />
          <AnimatedSection from="right" className="mt-8 flex flex-col gap-6">
            <div className="flex items-start gap-3 rounded-2xl border border-success/25 bg-transparent/10 p-4">
              <Store className="mt-0.5 size-5 shrink-0 text-black" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-foreground">Your prices stay yours</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  A flat monthly fee with no commission. You keep the full price customers pay.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-[#0052FF]/20 bg-transparent/5 p-4">
              <MessageSquare className="mt-0.5 size-5 shrink-0 text-black" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-foreground">Reports from real order records</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Analytics read your stored orders, so the numbers move as orders come in.
                </p>
              </div>
            </div>
            <div>
              <Link href="/business">
                <Button size="lg" className="group">
                  Open the dashboard
                </Button>
              </Link>
              <p className="mt-3 text-sm text-muted-foreground">
                No setup fees, and you can cancel any time.{" "}
                <Link href="/pricing" className="font-semibold text-[#0052FF] hover:underline">
                  See plans
                </Link>
              </p>
            </div>
          </AnimatedSection>
        </div>
      </div>
    </SectionScreen>
  );
}