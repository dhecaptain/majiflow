import Link from "next/link";
import { HeartHandshake, Repeat, ShieldCheck, Users } from "lucide-react";
import { PageHero, PageSection } from "@/components/shared/page-hero";
import { SectionHeading } from "@/components/ui/section-heading";

const values = [
  { icon: ShieldCheck, title: "Verified stations", text: "Every station is verified before it is listed." },
  { icon: Repeat, title: "Built around Kenyan stations", text: "Each station keeps its own prices, hours and delivery area." },
  { icon: Users, title: "Support when you need it", text: "Our team helps customers and stations with orders and payments." },
  { icon: HeartHandshake, title: "Simple, fair pricing", text: "Stations pay a flat monthly fee, with no commission on orders." },
];

const timeline = [
  { marker: "Now", title: "The storefront", text: "Stations list products, prices and delivery fees, and customers order from them." },
  { marker: "Now", title: "Every order, tracked", text: "Orders move from placed to delivered, with each change recorded and visible." },
  { marker: "Next", title: "What comes next", text: "Recurring refills, loyalty tools and multi-branch support are on the roadmap." },
];

export const metadata = {
  title: "About us",
  description:
    "MajiFlow connects homes to independent water refill stations across Kenya and gives those businesses the tools to grow.",
  alternates: { canonical: "/about" },
};

export default function About() {
  return (
    <>
      <PageHero
        label="About us"
        title="The best water company is already in your town"
        description="MajiFlow connects homes with the independent refill stations near them, and gives those stations the tools to grow."
        aside={
          <figure className="rounded-xl bg-foreground p-6 text-white lg:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--footer-sky)]">What we stand for</p>
            <blockquote className="mt-3 font-display text-xl font-bold leading-snug lg:text-2xl">
              Clean water should be close to home, and the businesses that deliver it should have the tools to grow.
            </blockquote>
          </figure>
        }
      />

      <PageSection>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
          <div className="flex flex-col gap-4">
            <SectionHeading label="Why we exist" title="Local water, better tools" />
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              Refill stations already filter safe, affordable water in every estate. What they lack is a simple way to
              take orders, show their prices and deliver. We build that: a page for products and prices, a cart that shows
              the station&apos;s own delivery fee, and a dashboard for orders.
            </p>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              For you, that means water filtered close to home, from a business you can see on the map.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {values.map((v) => (
              <li key={v.title} className="flex flex-col gap-2 rounded-xl border border-border bg-white p-5">
                <span className="flex size-10 items-center justify-center rounded-md bg-brand-soft text-[var(--brand)]">
                  <v.icon className="size-5" aria-hidden />
                </span>
                <span className="text-base font-bold text-foreground">{v.title}</span>
                <span className="text-sm leading-relaxed text-muted-foreground">{v.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </PageSection>

      <PageSection tinted>
        <SectionHeading label="How it is put together" title="A storefront, orders, and the road ahead" />
        <ol className="mt-6 grid gap-3 md:grid-cols-3">
          {timeline.map((t) => (
            <li key={t.title} className="flex flex-col gap-2 rounded-xl border border-border bg-white p-5">
              <span
                className={
                  t.marker === "Now"
                    ? "self-start rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-bold text-success"
                    : "self-start rounded-full bg-aqua-soft px-2.5 py-0.5 text-xs font-bold text-[#00707d]"
                }
              >
                {t.marker}
              </span>
              <span className="text-base font-bold text-foreground">{t.title}</span>
              <span className="text-sm leading-relaxed text-muted-foreground">{t.text}</span>
            </li>
          ))}
        </ol>
      </PageSection>

      <PageSection>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/browse"
            className="flex flex-col gap-1 rounded-xl bg-[var(--brand)] p-6 text-white transition-colors hover:bg-[var(--cta-hover)]"
          >
            <span className="text-lg font-extrabold">Order water</span>
            <span className="text-sm text-[#e1f1ff]">Find the stations that deliver to you.</span>
          </Link>
          <Link
            href="/for-business"
            className="flex flex-col gap-1 rounded-xl border border-border bg-white p-6 transition-colors hover:border-[var(--brand)]/40"
          >
            <span className="text-lg font-extrabold text-foreground">List your station</span>
            <span className="text-sm text-muted-foreground">Take orders from customers nearby.</span>
          </Link>
        </div>
      </PageSection>
    </>
  );
}
